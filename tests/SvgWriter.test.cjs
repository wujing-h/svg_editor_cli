// 用途：验证原生 SVG 序列化、元素顺序、样式省略和 XML 文本及属性转义。
const assert = require("node:assert/strict");
const test = require("node:test");
const { SvgDocument } = require("../dist/domain/SvgDocument.js");
const { ShapeFactory } = require("../dist/domain/ShapeFactory.js");
const { SvgWriter } = require("../dist/infrastructure/SvgWriter.js");

test("writer emits an independent empty SVG with dimensions, namespace, and matching viewBox", () => {
  const document = new SvgDocument(400.5, 300);
  assert.deepEqual(new SvgWriter().serialize(document), {
    content: '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="400.5" height="300" viewBox="0 0 400.5 300">\n</svg>\n',
    elementCount: 0,
  });
});

test("writer serializes all six types in tree order, preserving explicit and omitted styles", () => {
  const factory = new ShapeFactory();
  const document = new SvgDocument(400, 300);
  document.insert(factory.create("g", "scene", { fill: "blue" }));
  for (const [kind, id, values, text] of [
    ["rect", "r", { x: 1, y: 2, width: 3, height: 4, fill: "none" }],
    ["circle", "c", { cx: 5, cy: 6, r: 7 }],
    ["ellipse", "e", { cx: 8, cy: 9, rx: 10, ry: 11 }],
    ["line", "l", { x1: 12, y1: 13, x2: 14, y2: 15, stroke: "black", "stroke-width": 0 }],
    ["text", "t", { x: 16, y: 17 }, "label"],
  ]) {
    document.insert(factory.create(kind, id, values, text), "scene");
  }
  document.insert(factory.create("g", "nested"), "scene");
  document.insert(factory.create("text", "empty", { x: 0, y: 0 }, ""), "nested");
  const before = document.getRootShapes().map((shape) => shape.describe());
  const svg = new SvgWriter().serialize(document);
  assert.equal(svg.elementCount, 8);
  assert.deepEqual(svg.content.split("\n").slice(2, -2), [
    '  <g id="scene" fill="blue">',
    '    <rect id="r" x="1" y="2" width="3" height="4" fill="none"/>',
    '    <circle id="c" cx="5" cy="6" r="7"/>',
    '    <ellipse id="e" cx="8" cy="9" rx="10" ry="11"/>',
    '    <line id="l" x1="12" y1="13" x2="14" y2="15" stroke="black" stroke-width="0"/>',
    '    <text id="t" x="16" y="17">label</text>',
    '    <g id="nested">',
    '      <text id="empty" x="0" y="0"></text>',
    '    </g>',
    '  </g>',
  ]);
  assert.doesNotMatch(svg.content, /<image|data:|geometry=|position=/);
  assert.deepEqual(document.getRootShapes().map((shape) => shape.describe()), before);
});

test("writer escapes attributes and text while preserving Unicode and exact text whitespace", () => {
  const document = new SvgDocument(100, 100);
  const factory = new ShapeFactory();
  const id = 'a&<"\'\n\t\r';
  const text = '  中文😀 <&> "quoted"\r\n\t  ';
  document.insert(factory.create("text", id, { x: 1, y: 2, fill: 'a&"\n\t\r' }, text));
  const content = new SvgWriter().serialize(document).content;
  assert.ok(content.includes('id="a&amp;&lt;&quot;&apos;&#10;&#9;&#13;"'));
  assert.ok(content.includes('fill="a&amp;&quot;&#10;&#9;&#13;"'));
  assert.ok(content.includes('>  中文😀 &lt;&amp;&gt; "quoted"&#13;\n\t  </text>'));
  assert.equal(document.findShape(id).describe().text, text);
});

test("writer rejects XML-illegal characters without changing the document", () => {
  const document = new SvgDocument(100, 100);
  const text = new ShapeFactory().create("text", "t", { x: 1, y: 2 }, "content");
  document.insert(text);
  for (const value of ["a\u0000b", "\u000B", "\uD800", "\uFFFF"]) {
    text.setAttribute("text", value);
    const before = text.describe();
    assert.throws(() => new SvgWriter().serialize(document), /invalid XML character/);
    assert.deepEqual(text.describe(), before);
  }
});
