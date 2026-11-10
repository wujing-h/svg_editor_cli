// 用途：验证大纲层级、源码区间、编辑更新及错误恢复，不依赖 VSCode 运行时。
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { XmlOutlineParser } = require("../dist/XmlOutlineParser.js");

const fixture = (name) => fs.readFileSync(path.join(__dirname, "../fixtures", name), "utf8");

test("outline includes the root, nested groups, leaves, and unnamed text in source order", () => {
  const source = fixture("example.svg");
  const [root] = new XmlOutlineParser().parse(source);
  assert.equal(root.name, "svg");
  const [flow] = root.children;
  assert.equal(flow.name, "g#flow");
  assert.deepEqual(flow.children.map((node) => node.name), ["rect#start", "g#nested"]);
  assert.equal(flow.children[1].children[0].name, "text");
  assert.equal(source.slice(root.start, root.end), source.slice(source.indexOf("<svg"), source.indexOf("</svg>") + 6));
});

test("missing IDs are left unnamed instead of being synthesized or written to the file", () => {
  const source = fixture("missing-id.svg");
  const [root] = new XmlOutlineParser().parse(source);
  assert.equal(root.name, "svg");
  assert.equal(root.children[0].name, "g");
  assert.deepEqual(root.children[0].children.map((node) => node.name), ["circle", "text"]);
  assert.equal(fixture("missing-id.svg"), source);
});

test("UTF-16 source ranges retain CRLF, Unicode, entities, and multiline attributes", () => {
  const source = '\uFEFF<svg>\r\n  <!-- 中文😀 -->\r\n  <text\r\n    id="标题&amp;说明">你好</text>\r\n</svg>';
  const [root] = new XmlOutlineParser().parse(source);
  const [text] = root.children;
  assert.equal(root.start, 1);
  assert.equal(root.end, source.length);
  assert.equal(text.name, "text#标题&说明");
  assert.equal(source.slice(text.start, text.end), '<text\r\n    id="标题&amp;说明">你好</text>');
  assert.equal(source.slice(text.selectionStart, text.selectionEnd), "text");
  assert.equal(text.start, source.indexOf("<text"));
});

test("self-closing and explicitly closed empty elements have exact independent ranges", () => {
  const source = '<svg><g id="outer"><g/><rect></rect></g><circle /></svg>';
  const [root] = new XmlOutlineParser().parse(source);
  assert.equal(source.slice(root.children[0].start, root.children[0].end), '<g id="outer"><g/><rect></rect></g>');
  assert.deepEqual(root.children[0].children.map((node) => source.slice(node.start, node.end)), ["<g/>", "<rect></rect>"]);
  assert.equal(source.slice(root.children[1].start, root.children[1].end), "<circle />");
});

test("comments, processing instructions, CDATA, and quoted delimiters do not create false elements", () => {
  const source = '<?xml version="1.0"?><svg><!-- <g/> --><text><![CDATA[<rect/>]]></text><path id="a&amp;b" d="M0 > 1"/></svg>';
  const [root] = new XmlOutlineParser().parse(source);
  assert.deepEqual(root.children.map((node) => node.name), ["text", "path#a&b"]);
  assert.deepEqual(root.children[0].children, []);
  assert.equal(source.slice(root.children[1].start, root.children[1].end), '<path id="a&amp;b" d="M0 > 1"/>');
});

test("prefixed namespaces and SVG elements outside the CLI whitelist remain visible", () => {
  const source = '<s:svg xmlns:s="http://www.w3.org/2000/svg"><s:defs><s:linearGradient id="paint"/></s:defs><s:path d="M0 0"/></s:svg>';
  const [root] = new XmlOutlineParser().parse(source);
  assert.equal(root.name, "s:svg");
  assert.deepEqual(root.children.map((node) => node.name), ["s:defs", "s:path"]);
  assert.equal(root.children[0].children[0].name, "s:linearGradient#paint");
});

test("duplicate IDs are displayed as XML nodes without applying CLI model constraints", () => {
  const [root] = new XmlOutlineParser().parse('<svg><g id="same"/><g id="same"/></svg>');
  assert.deepEqual(root.children.map((node) => node.name), ["g#same", "g#same"]);
});

test("each parse reflects current edited text without changing previously returned nodes", () => {
  const parser = new XmlOutlineParser();
  const before = parser.parse('<svg><rect id="old"/></svg>');
  const after = parser.parse('<svg>\n<g id="new"><text/></g>\n</svg>');
  assert.deepEqual(before[0].children.map((node) => node.name), ["rect#old"]);
  assert.deepEqual(after[0].children.map((node) => node.name), ["g#new"]);
  assert.equal(after[0].children[0].children[0].name, "text");
});

test("incomplete and malformed XML clear the entire outline without throwing", () => {
  const parser = new XmlOutlineParser();
  for (const source of [
    fixture("incomplete.svg"), "", " ", "<svg>", "<svg><g></svg>",
    '<svg><rect id="unfinished></rect></svg>', "<svg/><g/>", "< svg/>",
    "<svg><text>&unknown;</text></svg>", "<svg><unbound:g/></svg>",
  ]) {
    assert.deepEqual(parser.parse(source), [], source);
  }
});

test("a valid edit restores the outline after a failed parse", () => {
  const parser = new XmlOutlineParser();
  assert.deepEqual(parser.parse("<svg><g>"), []);
  assert.equal(parser.parse('<svg><g id="repaired"/></svg>')[0].children[0].name, "g#repaired");
});

test("cancelled parses return no partial tree and the parser remains reusable", () => {
  const parser = new XmlOutlineParser();
  const source = "<svg><g><rect/></g></svg>";
  assert.deepEqual(parser.parse(source, () => true), []);
  let checks = 0;
  assert.deepEqual(parser.parse(source, () => ++checks > 2), []);
  assert.equal(parser.parse(source)[0].children[0].name, "g");
});

test("all child and selection ranges are contained by their parent element", () => {
  const source = fixture("example.svg");
  const roots = new XmlOutlineParser().parse(source);
  const inspect = (node) => {
    assert.ok(0 <= node.start && node.start < node.end && node.end <= source.length);
    assert.ok(node.start <= node.selectionStart && node.selectionStart < node.selectionEnd && node.selectionEnd <= node.end);
    for (const child of node.children) {
      assert.ok(node.start <= child.start && child.end <= node.end);
      inspect(child);
    }
  };
  assert.equal(roots.length, 1);
  roots.forEach(inspect);
});
