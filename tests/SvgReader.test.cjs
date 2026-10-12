// 用途：验证限定 SVG 读取、命名空间、缺 id 分配、严格错误与保存读回。
const assert = require("node:assert/strict");
const test = require("node:test");
const { SvgReader } = require("../dist/infrastructure/SvgReader.js");
const { SvgWriter } = require("../dist/infrastructure/SvgWriter.js");
const { SvgDocument } = require("../dist/domain/SvgDocument.js");
const { ShapeFactory } = require("../dist/domain/ShapeFactory.js");

const svg = (children, attributes = 'width="400" height="300"') => `<svg xmlns="http://www.w3.org/2000/svg" ${attributes}>${children}</svg>`;
const describe = (document) => document.getRootShapes().map((shape) => shape.describe());

test("reader reserves future explicit IDs and assigns deterministic case-sensitive IDs in tree order", () => {
  const input = svg('<rect width="10" height="20"/><rect id="rect1"/><g><circle id="circle1" r="3"/><circle r="4"/><text>hello</text></g><rect id="Rect1"/><g id="g1"/>');
  const loaded = new SvgReader().parse(input);
  assert.equal(loaded.elementCount, 8);
  assert.deepEqual(loaded.warnings, [
    { kind: "rect", id: "rect2" }, { kind: "g", id: "g2" },
    { kind: "circle", id: "circle2" }, { kind: "text", id: "text1" },
  ]);
  assert.deepEqual(loaded.document.getRootShapes().map((shape) => shape.id), ["rect2", "rect1", "g2", "Rect1", "g1"]);
  assert.deepEqual(loaded.document.findContainer("g2").children.map((shape) => shape.id), ["circle1", "circle2", "text1"]);
  assert.equal(loaded.document.findShape("text1").parent, loaded.document.findShape("g2"));
  assert.equal(loaded.document.findShape("circle2").document, loaded.document);
  assert.deepEqual(loaded.document.findShape("rect2").describe().attributes, { x: 0, y: 0, width: 10, height: 20 });
});

test("reader accepts prefixed and unqualified SVG and preserves group-inherited text presentation", () => {
  const loaded = new SvgReader().parse('<s:svg xmlns:s="http://www.w3.org/2000/svg" width="400px" height="300"><s:g id="scene" font-size="16px" text-anchor="middle"><s:text id="title" x="10px" y="20">  中文 &amp; <![CDATA[<label>]]>  </s:text></s:g></s:svg>');
  assert.deepEqual(loaded.document.getCanvasSize(), { width: 400, height: 300 });
  assert.deepEqual(loaded.document.findShape("scene").describe().attributes, { "font-size": "16px", "text-anchor": "middle" });
  const text = loaded.document.findShape("title");
  assert.equal(text.describe().text, "  中文 & <label>  ");
  assert.deepEqual(text.describe().attributes, { x: 10, y: 20 });
  assert.throws(() => text.setAttribute("font-size", "20"), /unknown attribute: font-size/);
  assert.throws(() => loaded.document.findShape("scene").setAttribute("text-anchor", "end"), /unknown attribute: text-anchor/);
  assert.equal(new SvgReader().parse('<svg width="1" height="2"><g id="plain"/></svg>').document.findShape("plain").kind, "g");
});

test("reader supports matching or dimension-only viewBox and normalizes SVG geometry defaults and px lengths", () => {
  const loaded = new SvgReader().parse(svg('<circle id="c" r="2px"/><ellipse id="e" ry="3px"/><line id="l" stroke-width="2px"/><text id="t"/>', 'viewBox="0,0,400,300"'));
  assert.deepEqual(loaded.document.getCanvasSize(), { width: 400, height: 300 });
  assert.deepEqual(loaded.document.findShape("c").describe().attributes, { cx: 0, cy: 0, r: 2 });
  assert.deepEqual(loaded.document.findShape("e").describe().attributes, { cx: 0, cy: 0, rx: 3, ry: 3 });
  assert.deepEqual(loaded.document.findShape("l").describe().attributes, { x1: 0, y1: 0, x2: 0, y2: 0, "stroke-width": 2 });
  assert.equal(loaded.document.findShape("t").describe().text, "");
});

test("writer-reader round trip preserves all six types, order, explicit styles, Unicode, and exact whitespace", () => {
  const factory = new ShapeFactory();
  const document = new SvgDocument(400, 300);
  document.insert(factory.create("g", "scene", { fill: "blue", "font-size": "16", "text-anchor": "middle" }));
  for (const [kind, id, attributes, content] of [
    ["rect", 'r&"', { x: 1, y: 2, width: 3, height: 4, fill: "none" }],
    ["circle", "c", { cx: 5, cy: 6, r: 7 }],
    ["ellipse", "e", { cx: 8, cy: 9, rx: 10, ry: 11 }],
    ["line", "l", { x1: 12, y1: 13, x2: 14, y2: 15, stroke: "black", "stroke-width": 0 }],
    ["text", "t", { x: 16, y: 17, fill: 'a\n\t\r&"' }, '  中文😀 <&> "quoted"\r\n\t\u0085\u2028\u2029  '],
    ["g", "empty", {}],
  ]) {
    document.insert(factory.create(kind, id, attributes, content), "scene");
  }
  const writer = new SvgWriter();
  const serialized = writer.serialize(document);
  const loaded = new SvgReader().parse(serialized.content);
  assert.equal(loaded.elementCount, serialized.elementCount);
  assert.deepEqual(loaded.warnings, []);
  assert.deepEqual(describe(loaded.document), describe(document));
  assert.equal(writer.serialize(loaded.document).content, serialized.content);
});

test("reader rejects malformed XML and illegal raw or referenced characters instead of recovering", () => {
  for (const input of [
    "", '<svg width="1" height="1"><g></svg>', '<svg width="1" height="1"><g>',
    '<svg width=1 height="1"/>', svg('<g id="a" id="b"/>'), svg("<text>&unknown;</text>"),
    svg("<text>\u0000</text>"), svg("<text>&#0;</text>"), svg('<text id="&#xD800;"/>'),
    '<svg width="1" height="1"/><svg width="2" height="2"/>',
  ]) {
    assert.throws(() => new SvgReader().parse(input), undefined, input);
  }
});

test("reader rejects duplicate IDs, unsupported elements, attributes, children, namespaces, and processing instructions", () => {
  for (const input of [
    svg('<g id="same"><rect id="same"/></g>'), svg("<path/>"), svg('<g transform="translate(1,2)"/>'),
    svg('<text style="font-size:16px">hello</text>'), svg('<g data-kind="box"/>'),
    svg('<text><tspan>hello</tspan></text>'), svg('<rect><circle/></rect>'), svg("<g>unexpected text</g>"),
    svg('<g xmlns="http://other.example"/>'), '<svg xmlns="http://other.example" width="1" height="1"/>',
    svg('<g xmlns:x="http://other.example" x:id="other"/>'), svg("<?xml-stylesheet href='other.css'?>"),
    `<?xml-stylesheet href="other.css"?>${svg("")}`, `<!DOCTYPE svg>${svg("")}`,
    svg("", 'width="1" height="1" onclick="alert(1)"'), svg('<circle r="10%"/>'),
  ]) {
    assert.throws(() => new SvgReader().parse(input), undefined, input);
  }
});

test("reader rejects unsupported coordinate systems, invalid canvas and negative geometry", () => {
  for (const input of [
    svg("", 'width="1" height="1" viewBox="1 0 1 1"'), svg("", 'width="1" height="1" viewBox="0 0 2 1"'),
    svg("", 'viewBox="0 0 1"'), svg("", 'viewBox="0px 0 1 1"'), svg("", 'width="100%" height="1"'),
    svg("", 'width="0" height="1"'), svg("", ""), svg('<rect width="-1"/>'),
    svg('<circle r="NaN"/>'), svg('<text font-size=""/>'), svg('<text text-anchor="invalid"/>'),
  ]) {
    assert.throws(() => new SvgReader().parse(input), undefined, input);
  }
});

test("reader can be reused after failure and never returns accumulated warnings from older reads", () => {
  const reader = new SvgReader();
  assert.throws(() => reader.parse(svg('<rect/><path/>')));
  const loaded = reader.parse(svg('<rect id=""/><g/>'));
  assert.deepEqual(loaded.warnings, [{ kind: "rect", id: "rect1" }, { kind: "g", id: "g1" }]);
  assert.deepEqual(reader.parse(svg('<g id="named"/>')).warnings, []);
});
