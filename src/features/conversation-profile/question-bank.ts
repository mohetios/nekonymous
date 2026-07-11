import { CONVERSATION_DIMENSIONS, PROFILE_QUESTION_COUNT } from "./constants.ts";
import type { ConversationDimension, ProfileQuestion } from "./types.ts";

const selfText = (
  dimension: ConversationDimension,
  item: 1 | 2
): { fa: string; en: string } => {
  const copy: Record<ConversationDimension, [{ fa: string; en: string }, { fa: string; en: string }]> = {
    depth: [
      {
        fa: "معمولاً دوست دارم گفت‌وگو به موضوع‌های عمیق‌تر برسد.",
        en: "I usually like conversations to move toward deeper topics.",
      },
      {
        fa: "برایم راحت است درباره‌ی معنا، احساس یا تجربه‌های مهم حرف بزنم.",
        en: "I am comfortable talking about meaning, feelings, or important experiences.",
      },
    ],
    replyPace: [
      {
        fa: "ترجیح می‌دهم در گفت‌وگوها پاسخ‌ها نسبتاً سریع رد و بدل شود.",
        en: "I prefer fairly quick back-and-forth in chats.",
      },
      {
        fa: "وقتی پیامی می‌فرستم، معمولاً منتظر ادامه‌ی زودهنگام گفت‌وگو هستم.",
        en: "When I send a message, I usually expect the conversation to continue soon.",
      },
    ],
    directness: [
      {
        fa: "معمولاً خواسته‌ها و نظرم را روشن و مستقیم می‌گویم.",
        en: "I usually state my needs and opinions clearly and directly.",
      },
      {
        fa: "برایم مهم است در گفت‌وگو کمتر حدس بزنم طرف مقابل چه منظوری دارد.",
        en: "I prefer not to guess what the other person means in a conversation.",
      },
    ],
    energy: [
      {
        fa: "در گفت‌وگو معمولاً انرژی و هیجان نسبتاً بالایی دارم.",
        en: "I usually bring fairly high energy to conversations.",
      },
      {
        fa: "دوست دارم گفت‌وگو پرتحرک و پر از پیام‌های پی‌درپی باشد.",
        en: "I like chats that feel active with frequent messages.",
      },
    ],
    playfulness: [
      {
        fa: "در گفت‌وگو از شوخی و لحن سبک‌تر استفاده می‌کنم.",
        en: "I use humor and a lighter tone in conversation.",
      },
      {
        fa: "برایم طبیعی است گاهی گفت‌وگو را با لحن بازیگوشانه ادامه دهم.",
        en: "It feels natural for me to keep a playful tone at times.",
      },
    ],
    supportStyle: [
      {
        fa: "وقتی کسی ناراحت است، اول می‌خواهم شنیده شود و همدلی شود.",
        en: "When someone is upset, I want them to feel heard first.",
      },
      {
        fa: "در موقعیت‌های احساسی، فوراً به دنبال راه‌حل عملی نمی‌روم.",
        en: "In emotional situations, I do not immediately jump to practical fixes.",
      },
    ],
    disclosurePace: [
      {
        fa: "معمولاً نسبتاً زود درباره‌ی موضوع‌های شخصی صحبت می‌کنم.",
        en: "I usually open up about personal topics fairly early.",
      },
      {
        fa: "برایم طبیعی است در گفت‌وگوهای تازه، به‌تدریج جزئیات بیشتری بگویم.",
        en: "In new chats, I naturally share more detail over time.",
      },
    ],
    repairStyle: [
      {
        fa: "اگر سوءتفاهمی پیش بیاید، سریع تلاش می‌کنم گفت‌وگو را ترمیم کنم.",
        en: "If a misunderstanding happens, I try to repair the conversation quickly.",
      },
      {
        fa: "برایم مهم است بعد از اختلاف کوچک، دوباره ارتباط را عادی کنم.",
        en: "After a small conflict, I care about restoring normal contact.",
      },
    ],
  };

  return copy[dimension][item - 1];
};

const desiredText = (
  dimension: ConversationDimension
): { fa: string; en: string } => {
  const copy: Record<ConversationDimension, { fa: string; en: string }> = {
    depth: {
      fa: "در گفت‌وگوی ایده‌آل، چه عمقی برایت راحت‌تر است؟",
      en: "In an ideal chat, what depth feels most comfortable for you?",
    },
    replyPace: {
      fa: "در گفت‌وگوی ایده‌آل، چه ریتمی از پاسخ‌دهی را ترجیح می‌دهی؟",
      en: "In an ideal chat, what reply pace do you prefer?",
    },
    directness: {
      fa: "در گفت‌وگوی ایده‌آل، طرف مقابل چقدر مستقیم باشد؟",
      en: "In an ideal chat, how direct should the other person be?",
    },
    energy: {
      fa: "در گفت‌وگوی ایده‌آل، چه سطحی از انرژی را دوست داری؟",
      en: "In an ideal chat, what energy level do you prefer?",
    },
    playfulness: {
      fa: "در گفت‌وگوی ایده‌آل، چقدر شوخی و لحن سبک برایت مناسب است؟",
      en: "In an ideal chat, how much playfulness feels right?",
    },
    supportStyle: {
      fa: "در گفت‌وگوی ایده‌آل، طرف مقابل بیشتر شنونده باشد یا راه‌حل بدهد؟",
      en: "In an ideal chat, should the other person listen more or offer solutions?",
    },
    disclosurePace: {
      fa: "در گفت‌وگوی ایده‌آل، چقدر زود باز شدن درباره‌ی موضوع‌های شخصی را می‌پسندی؟",
      en: "In an ideal chat, how quickly should personal topics open up?",
    },
    repairStyle: {
      fa: "در گفت‌وگوی ایده‌آل، بعد از سوءتفاهم چه واکنشی را ترجیح می‌دهی؟",
      en: "In an ideal chat, how should misunderstandings be handled?",
    },
  };

  return copy[dimension];
};

const buildInterleavedQuestions = (): ProfileQuestion[] => {
  const questions: ProfileQuestion[] = [];
  let index = 0;

  for (const item of [1, 2] as const) {
    for (const dimension of CONVERSATION_DIMENSIONS) {
      const text = selfText(dimension, item);
      questions.push({
        id: `self_${dimension}_${item}`,
        index,
        kind: "self",
        dimension,
        selfItem: item,
        text: text.fa,
        textEn: text.en,
      });
      index += 1;
    }
  }

  for (const dimension of CONVERSATION_DIMENSIONS) {
    const text = desiredText(dimension);
    questions.push({
      id: `desired_${dimension}`,
      index,
      kind: "desired",
      dimension,
      text: text.fa,
      textEn: text.en,
    });
    index += 1;
  }

  questions.push({
    id: "intent_current",
    index,
    kind: "intent",
    text: "الان بیشتر به چه نوع گفت‌وگویی میل داری؟",
    textEn: "What kind of conversation are you most open to right now?",
  });

  return questions;
};

export const PROFILE_QUESTIONS = buildInterleavedQuestions();

if (PROFILE_QUESTIONS.length !== PROFILE_QUESTION_COUNT) {
  throw new Error(`PROFILE_QUESTIONS must contain ${PROFILE_QUESTION_COUNT} items`);
}

export const PROFILE_QUESTION_BY_INDEX = new Map(
  PROFILE_QUESTIONS.map((question) => [question.index, question])
);

export const PROFILE_QUESTION_BY_ID = new Map(
  PROFILE_QUESTIONS.map((question) => [question.id, question])
);
