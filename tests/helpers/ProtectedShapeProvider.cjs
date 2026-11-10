// 用途：以独立测试提供者验证复合子树读回协议，不实现真实 box 插件。
const { ProtectedGroup } = require("./ProtectedGroup.cjs");

class ProtectedShapeProvider {
  constructor() {
    this.name = "protected";
    this.inputs = [];
  }

  create(id, attributes = {}, text) {
    if (text !== undefined) throw new Error("unexpected protected text");
    return new ProtectedGroup(id, undefined, this.styles(attributes));
  }

  createFromParameters(id, parameters) {
    if (parameters.length > 1) throw new Error("usage: create protected <id> [fill]");
    return this.create(id, parameters.length === 0 ? {} : { fill: parameters[0] });
  }

  createFromSvg(input) {
    if (input.tagName !== "g" || input.attributes["data-kind"] !== this.name) {
      throw new Error("protected shape requires <g data-kind=protected>");
    }
    if (input.text.trim() !== "") throw new Error("unexpected protected text");
    const attributes = { ...input.attributes };
    delete attributes["data-kind"];
    this.inputs.push(input);
    return new ProtectedGroup(input.id, input.children, this.styles(attributes));
  }

  styles(attributes) {
    for (const name of Object.keys(attributes)) {
      if (name !== "fill") throw new Error(`unknown attribute: ${name}`);
    }
    if (attributes.fill !== undefined && typeof attributes.fill !== "string") throw new Error("invalid fill");
    return attributes.fill === undefined ? {} : { fill: attributes.fill };
  }
}

module.exports = { ProtectedShapeProvider };
