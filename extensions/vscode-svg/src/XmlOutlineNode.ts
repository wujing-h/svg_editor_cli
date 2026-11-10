// 用途：定义大纲的只读展示节点；源码区间使用从零开始、末端不包含在内的 UTF-16 偏移。
export interface XmlOutlineNode {
  readonly name: string;
  readonly start: number;
  readonly end: number;
  readonly selectionStart: number;
  readonly selectionEnd: number;
  readonly children: readonly XmlOutlineNode[];
}
