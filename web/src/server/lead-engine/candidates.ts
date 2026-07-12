export function rejectionReasonForMissingContact() {
  return "未找到符合规则的关键负责人个人工作邮箱，按规则淘汰并替换";
}

export function rejectionReasonForDuplicate() {
  return "重复公司候选，按规则淘汰并替换";
}

export function rejectionReasonForScore() {
  return "线索评分不足，按规则淘汰并替换";
}
