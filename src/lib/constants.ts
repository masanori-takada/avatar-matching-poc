import type { IconName } from "@/components/ui/IconSprite";
import type { AxisDefinition } from "@/types/domain";

/**
 * 5段階ステップインジケーター(poc/app.js STEPS)。
 */
export interface StepDefinition {
  label: string;
  icon: IconName;
}

export const STEPS: readonly StepDefinition[] = [
  { label: "登録完了", icon: "i-check" },
  { label: "インタビュー完了", icon: "i-chat" },
  { label: "アバターが会話中", icon: "i-avatar-pair" },
  { label: "相性が高い時に通知", icon: "i-bell" },
  { label: "会話ログを読んで判断", icon: "i-doc" },
] as const;

/**
 * 相性レポート5軸の定義(docs/03-data-model.md §5.3)。
 * `label` と `invertedGood` は LLM に持たせず、ここから埋める。
 */
export const AXIS_DEFINITIONS: readonly AxisDefinition[] = [
  { key: "flow", label: "会話の弾み", invertedGood: false, weight: 0.25 },
  { key: "values", label: "価値観の一致", invertedGood: false, weight: 0.3 },
  { key: "humor", label: "ユーモアの相性", invertedGood: false, weight: 0.15 },
  { key: "interest", label: "相互関心", invertedGood: false, weight: 0.2 },
  { key: "conflict", label: "不一致の重大度", invertedGood: true, weight: 0.1 },
] as const;

export const AGE_RANGES: readonly string[] = [
  "10代",
  "20代前半",
  "20代後半",
  "30代前半",
  "30代後半",
  "40代前半",
  "40代後半",
  "50代以上",
] as const;

/**
 * バッチ系の既定値(docs/02-architecture.md §6)。
 * 環境変数が未設定・不正な場合はここのフォールバックを使う。
 */
function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const MATCH_NOTIFY_THRESHOLD = readIntEnv("MATCH_NOTIFY_THRESHOLD", 75);
export const MATCH_BATCH_LIMIT = readIntEnv("MATCH_BATCH_LIMIT", 20);
export const MAX_OPEN_MATCHES_PER_PROFILE = readIntEnv("MAX_OPEN_MATCHES_PER_PROFILE", 3);

/**
 * UI文言(NFR-7: 表示文言はコンポーネントに直書きせず定数にまとめる)。
 * poc/index.html / poc/app.js の文言を踏襲する。
 */
export const COPY = {
  serviceName: "AIアバター自動マッチング",
  catchphrase: "AIが代わりに会っている。",

  invite: {
    heading: "AIアバター自動マッチング",
    description:
      "勤務先から配布された招待コードを入力してください。実名や所属は、相手とお互いがOKするまで誰にも表示されません。",
    codeLabel: "招待コード",
    codePlaceholder: "例: KARIYA-2026",
    submit: "登録する",
    errorEmpty: "招待コードを入力してください",
  },

  interview: {
    title: "AIインタビュー",
    intro: (count: number) =>
      `はじめまして。あなたのAIアバターです。これから${count}の質問にお答えください。あなたの答え方や考え方を学んで、私があなたの代わりに相手と話します。`,
    outro: "ありがとうございます。あなたのことがしっかり分かりました。あとは私にまかせて、ゆっくり休んでください。",
    inputPlaceholder: "回答を入力してください",
    send: "送信",
    finish: "アバターにまかせる",
  },

  waiting: {
    title: "AIが代わりに会っている。",
    lead: "あなたのAIアバターが相手のアバターと会話し、相性を確かめています。",
    cardTitle: "アバターが会話中です",
    cardBody: "あなたのアバターが、複数の候補アバターと会話を進めています。",
    note: "相性の基準を満たしたときだけ通知が届きます。基準に満たない場合は、何も起きません。",
    cta: "お知らせを見る",
  },

  notifications: {
    title: "お知らせ",
    empty: "まだお知らせはありません。アバターが会話を続けています。",
  },

  report: {
    partnerLabel: "お相手 A さん",
    partnerSub: "実名・所属は非表示です",
    partnerNote: "※お互いが「会う」を選ぶまで、実名・所属は表示されません。",
    empty: "まだレポートはありません。アバターが会話を続けています。",
    logNote: "これは、あなたが寝ている間にAIアバター同士が交わした会話です。",
    axesTitle: "相性レポート",
    summaryTitle: "総評",
    invertedGoodHint: "低いほど良い",
    decisionNote:
      "あなたの判断は相手には通知されません。両者が「会う」を選んだ場合のみ、お互いに開示されます。",
    accept: "会う",
    decline: "今回は辞退する",
    acceptedTitle: "あなたは「会う」を選択済みです",
    seeReveal: "開示情報を見る",
    waitingPartner: "お相手の回答をお待ちしています",
    declineSheetTitle: "辞退の確認",
    declineSheetMessage: "辞退すると、このお相手の情報は表示されなくなります。よろしいですか?",
    declineSheetConfirm: "辞退する",
  },

  declined: {
    title: "辞退しました",
    body: "辞退しました。相手には通知されません。アバターは引き続き会話を続けます。",
    backHome: "ホームに戻る",
  },

  reveal: {
    title: "お互いが「会う」を選びました",
    loading: "お相手も「会う」を選んでいます",
    slotsTitle: "面談候補日時",
    cta: "この日時で調整する",
    note: "開示された情報は、お二人以外には共有されません。人事・運営がこの内容を閲覧することはありません。",
    empty: "まだ開示できる情報はありません。相性レポートで「会う」を選ぶと表示されます。",
    waitingPartnerTitle: "お相手の回答をお待ちしています",
    waitingPartnerBody: "お相手が「会う」を選ぶと、実名情報と面談候補日時が表示されます。",
    nameLabel: "氏名",
    companyLabel: "所属",
    ageRangeLabel: "年代",
    messageLabel: "一言",
    unknownValue: "-",
    slotSubmit: "この日時で調整する",
    otherSlotChosen: "お相手は別の枠を選ばれました。運営が調整します。",
    waitingAfterSelect: "お相手の回答をお待ちしています",
  },

  done: {
    title: "日程を送信しました",
    body: "日程を送信しました。当日の会場・時間は追ってお知らせします。",
    backHome: "ホームに戻る",
  },

  home: {
    heroTitle: "AIが代わりに会っている。",
    heroLead: "あなたのAIアバターが相手のアバターと会話し、相性を確かめています。",
    statusCardTitle: "現在の状況",
    noticeTitle: "お知らせ",
    noticeSeeAll: "すべて見る >",
    noticeEmpty: "まだお知らせはありません。",
    bannerTitle: "安心・匿名の設計",
    bannerBody:
      "実名や所属は、あなたとお相手がOKした後にのみ開示されます。人事や運営がマッチ内容を見ることはできません。",
    statusAcceptedText: "お相手と面談日程を調整できます。",
    statusDeclinedText: "辞退しました。アバターは引き続き会話を続けています。",
    statusNotifiedText: "相性の高いお相手が見つかりました。会話ログと相性レポートを確認できます。",
    statusDefaultText: "あなたのアバターが、複数の候補アバターと会話を進めています。",
    statusActionNotified: "相性レポートを見る",
    statusActionDefault: "進行状況を見る",
  },

  privacy: {
    title: "プライバシーについて",
    openSettings: "設定を開く",
    cards: [
      {
        heading: "匿名性は前提条件です",
        body: "実名・所属はアプリのどこにも表示されません。両者が「会う」を選んだ後にのみ、お互いにだけ開示されます。",
      },
      {
        heading: "人事も運営者も見られません",
        body: "誰と会話しているか、どんなマッチが成立したかを、勤務先の人事や運営者が閲覧することはできません。",
      },
      {
        heading: "断っても伝わりません",
        body: "辞退した事実は相手に通知されません。「断られた」という体験が発生しない設計です。",
      },
      {
        heading: "あなたの回答の使われ方",
        body: "インタビューの回答は、あなたのAIアバターがあなたらしく振る舞うためにのみ使われます。",
      },
      {
        heading: "データの保存について",
        body: "入力内容はSupabase上のデータベースに保存され、行レベルセキュリティ(RLS)によって、ご本人と相互accept後の相手以外は参照できません。「設定」からアカウントと全データを削除できます。",
      },
    ],
  },

  faq: {
    title: "よくある質問",
    items: [
      {
        question: "相手は私のことをどこまで知っていますか?",
        answer: "実名・所属は知りません。アバター同士の会話を通じて、話し方や考え方が伝わります。",
      },
      {
        question: "アバターは私に無断で何かを決めますか?",
        answer: "決めません。アバターは会話をするだけで、会うかどうかは必ずご本人が判断します。",
      },
      {
        question: "通知が来ないのですが?",
        answer: "相性の基準を満たしたときだけ通知が届きます。基準に満たない場合は何も起きません。",
      },
      {
        question: "辞退したことは相手に伝わりますか?",
        answer: "伝わりません。",
      },
      {
        question: "会社に利用状況が知られますか?",
        answer: "知られません。人事が個人のマッチ内容を閲覧することはできません。",
      },
    ],
  },

  mypage: {
    title: "マイページ",
    currentStep: "現在のステップ",
    answersTitle: "インタビューの回答",
    noAnswers: "まだ回答がありません。",
  },

  profile: {
    title: "プロフィール",
    anonymousIdLabel: "匿名ID",
    companyLabel: "登録企業",
    note1: "実名・所属は登録されていますが、アプリ上には表示されません。",
    note2: "お互いが「会う」を選んだときにのみ、お二人の間だけで開示されます。",
    privacyLink: "プライバシーについて",
  },

  settings: {
    title: "設定",
    notifyLabel: "通知を受け取る",
    notifySaveError: "設定の保存に失敗しました",
    privacyLink: "プライバシーについて",
    faqLink: "よくある質問",
    deleteAccount: "アカウントを削除する",
    deleteAccountNote: "アカウントと全データを削除します。この操作は取り消せません。",
    deleteSheetTitle: "アカウント削除の確認",
    deleteSheetMessage: "アカウントと全データを削除します。よろしいですか?",
    deleteSheetConfirm: "削除する",
    deleteError: "削除に失敗しました。もう一度お試しください。",
  },

  nav: {
    home: "ホーム",
    mypage: "マイページ",
    messages: "メッセージ",
    profile: "プロフィール",
  },

  bellAriaLabel: "お知らせ",
} as const;
