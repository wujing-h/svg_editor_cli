// 用途：显式装配默认图形提供者，复用原有工厂、读取和保存行为测试。
const { ShapeFactory } = require("../../dist/domain/ShapeFactory.js");
const { PluginHost } = require("../../dist/application/PluginHost.js");
const { BuiltinShapes } = require("../../dist/builtins/BuiltinShapes.js");
const { SvgReader } = require("../../dist/infrastructure/SvgReader.js");
const { SvgWriter } = require("../../dist/infrastructure/SvgWriter.js");
const { SvgFileStore } = require("../../dist/infrastructure/SvgFileStore.js");

function createShapeFactory() {
  const host = new PluginHost({ editor: {}, directory: {} });
  const shapes = new BuiltinShapes();
  host.activate(shapes.manifest, shapes);
  return new ShapeFactory(host.shapes);
}

function createSvgReader() {
  return new SvgReader(createShapeFactory());
}

function createSvgFileStore() {
  return new SvgFileStore(new SvgWriter(), createSvgReader());
}

module.exports = { createShapeFactory, createSvgReader, createSvgFileStore };
