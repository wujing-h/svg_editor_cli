// 用途：为树结构的内部写入口提供凭据，普通调用方通过 SvgDocument 操作。
// 其他模块不应导入此内部凭据，也不应直接调用结构写方法。
export const treeMutationToken: unique symbol = Symbol("SvgDocument tree mutation");
