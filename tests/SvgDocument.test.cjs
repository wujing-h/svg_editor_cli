// 用途：验证领域文档自身防止非法尺寸和部分更新，不依赖 CLI 校验。
const assert = require("node:assert/strict");
const test = require("node:test");
const { SvgDocument } = require("../dist/domain/SvgDocument.js");

test("document rejects invalid dimensions before changing either dimension", () => {
  const document = new SvgDocument(400, 300);
  for (const invalid of [0, -1, NaN, Infinity, -Infinity]) {
    assert.throws(() => new SvgDocument(invalid, 300), /finite and positive/);
    assert.throws(() => new SvgDocument(400, invalid), /finite and positive/);
    assert.throws(() => document.resizeCanvas(999, invalid), /finite and positive/);
    assert.throws(() => document.resizeCanvas(invalid, 999), /finite and positive/);
    assert.deepEqual(document.getCanvasSize(), { width: 400, height: 300 });
  }

  const size = document.getCanvasSize();
  size.width = 1;
  assert.deepEqual(document.getCanvasSize(), { width: 400, height: 300 });
});
