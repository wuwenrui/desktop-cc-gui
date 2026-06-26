import zhPart1 from "./zh.part1";
import zhPart2 from "./zh.part2";
import zhPart3 from "./zh.part3";
import zhPart4 from "./zh.part4";
import zhPart5 from "./zh.part5";
import zhPart6 from "./zh.part6";
import zhPart7 from "./zh.part7";

const zhPart2Settings =
  (zhPart2 as { settings?: Partial<typeof zhPart1.settings> }).settings ?? {};
const zhPart3Settings =
  (zhPart3 as { settings?: Partial<typeof zhPart1.settings> }).settings ?? {};
const zhPart2Composer =
  (zhPart2 as { composer?: Partial<typeof zhPart1.composer> }).composer ?? {};
const zhPart3Composer =
  (zhPart3 as { composer?: Partial<typeof zhPart1.composer> }).composer ?? {};
const zhPart7Messages =
  (zhPart7 as { messages?: Partial<typeof zhPart1.messages> }).messages ?? {};

const zh = {
  ...zhPart1,
  ...zhPart2,
  ...zhPart3,
  ...zhPart4,
  ...zhPart5,
  ...zhPart6,
  messages: {
    ...zhPart1.messages,
    ...zhPart7Messages,
  },
  composer: {
    ...zhPart1.composer,
    ...zhPart2Composer,
    ...zhPart3Composer,
  },
  settings: {
    ...zhPart1.settings,
    ...zhPart2Settings,
    ...zhPart3Settings,
  },
};

export default zh;
