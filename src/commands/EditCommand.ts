/**
 * Command 模式：把一次编辑操作封装成对象，使其可以排队、记录、撤销、重做。
 *
 * 约定：
 * - 构造时完成全部校验并解析 id → 对象；校验失败直接抛错，不改变任何状态。
 * - execute() 可被重复调用（redo 即再次 execute），返回结果摘要。
 * - undo() 精确还原 execute() 之前的状态，返回结果摘要。
 */
export interface EditCommand {
  execute(): string;
  undo(): string;
}
