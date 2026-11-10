// 用途：仅供测试的复合容器，通过公开 API 保护必要部件，不注册真实业务插件。
const { GroupShape, RectShape, TextShape } = require("pj/plugin-api");

class ProtectedGroup extends GroupShape {
  constructor(id, children = [new RectShape(`${id}-body`, 1, 2, 30, 40), new TextShape(`${id}-caption`, 3, 4, "title")], styles = {}) {
    super(id, styles, children);
  }

  get type() {
    return "protected";
  }

  validateChildren(children) {
    for (const [suffix, implementation] of [["body", RectShape], ["caption", TextShape]]) {
      const required = this.children.find((child) => child.id === `${this.id}-${suffix}`);
      if (!(required instanceof implementation) || !children.includes(required)) {
        throw new Error(`required component must remain: ${this.id}-${suffix}`);
      }
    }
  }

  assertCanUngroup() {
    throw new Error(`cannot ungroup composite shape: ${this.id}`);
  }
}

module.exports = { ProtectedGroup };
