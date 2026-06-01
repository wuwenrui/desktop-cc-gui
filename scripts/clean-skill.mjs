import fs from "node:fs";

// 真实敏感信息 → 占位。长串在前，避免短子串先替换留下残片。
const RULES = [
  [/山西路桥建设集团辰润交通科技有限公司/g, "{{公司}}"],
  [/太原中铁轨道交通文化传媒科技有限公司/g, "{{公司}}"],
  [/太原中铁轨道文化传媒科技有限公司/g, "{{公司}}"],
  [/晋中新大宇不锈钢制品有限公司/g, "{{公司}}"],
  [/山西运城农村商业银行股份有限公司/g, "{{公司}}"],
  [/山西新大陆房地产开发有限公司/g, "{{公司}}"],
  [/山西恒建科工贸实业发展有限公司/g, "{{公司}}"],
  [/山西恒建模板实业发展有限公司/g, "{{公司}}"],
  [/山西新大宇物资有限公司/g, "{{公司}}"],
  [/潞城市锦晨化工有限公司/g, "{{公司}}"],
  [/辰润交通科技有限公司/g, "{{公司}}"],
  [/北京盈科（太原）律师事务所/g, "{{律所}}"],
  [/山西省第二人民医院/g, "{{客户单位}}"],
  [/\/Users\/wyh\/[^\s"')]*/g, "{{PATH}}"],
];

const file = process.argv[2];
if (!file) {
  console.error("usage: node clean-skill.mjs <file>");
  process.exit(1);
}
let txt = fs.readFileSync(file, "utf8");
let changed = 0;
for (const [re, rep] of RULES) {
  txt = txt.replace(re, () => {
    changed++;
    return rep;
  });
}
fs.writeFileSync(file, txt);
console.log(`cleaned(${changed}): ${file}`);
