import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.resolve(__dirname, "../../skills");

// 真实客户/律所/医院/他人路径等隐私信息，不得出现在打包的 skill 中
const FORBIDDEN = [
  "北京盈科（太原）律师事务所",
  "山西省第二人民医院",
  "辰润交通科技有限公司",
  "晋中新大宇不锈钢制品有限公司",
  "山西新大宇物资有限公司",
  "山西恒建科工贸实业发展有限公司",
  "山西恒建模板实业发展有限公司",
  "潞城市锦晨化工有限公司",
  "山西运城农村商业银行股份有限公司",
  "山西新大陆房地产开发有限公司",
  "太原中铁轨道交通文化传媒科技有限公司",
  "太原中铁轨道文化传媒科技有限公司",
  "/Users/wyh/",
];

function walkMd(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkMd(p));
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

test("打包的 skill 至少 7 个", () => {
  const files = walkMd(SKILLS_DIR);
  assert.ok(files.length >= 7, `应有至少 7 个 skill, 实际 ${files.length}`);
});

test("skill 不含真实客户/机构/他人路径等敏感信息", () => {
  const files = walkMd(SKILLS_DIR);
  const violations = [];
  for (const f of files) {
    const t = fs.readFileSync(f, "utf8");
    for (const s of FORBIDDEN) {
      if (t.includes(s)) violations.push(`${path.basename(f)} -> ${s}`);
    }
  }
  assert.deepStrictEqual(violations, [], `发现敏感串:\n${violations.join("\n")}`);
});
