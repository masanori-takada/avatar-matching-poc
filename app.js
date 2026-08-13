/* =========================================================================
   AIアバター自動マッチング PoCデモ
   依存ライブラリなし / 外部通信なし
   ========================================================================= */
(function () {
  'use strict';

  /* =======================================================================
     固定データ
     ======================================================================= */

  var STORAGE_KEY = 'avatarMatchingDemo.v1';

  // インタビュー設問(選択式4問+自由記述2問)
  var QUESTIONS = [
    { id: 'q1', type: 'choice', text: '休日の過ごし方に近いのはどちらですか?',
      options: ['外に出かけて人と会う', '家でゆっくり自分の時間', '日によって半々くらい'] },
    { id: 'q2', type: 'choice', text: '初対面の人と話すとき、あなたは?',
      options: ['自分から話しかける方', '相手が話すのを聞く方', '場の空気を見て決める'] },
    { id: 'q3', type: 'free', text: '最近、思わず時間を忘れて夢中になったことは何ですか?' },
    { id: 'q4', type: 'choice', text: '一緒にいて心地よいと感じるのは、どんな人ですか?',
      options: ['笑いのツボが合う人', '価値観や考え方が近い人', '自分にない視点をくれる人'] },
    { id: 'q5', type: 'choice', text: '将来について、今の気持ちに近いのは?',
      options: ['具体的に考えている', 'なんとなく考えている', 'まだこれから考えたい'] },
    { id: 'q6', type: 'free', text: '相手に、これだけは知っておいてほしいことはありますか?' }
  ];

  // NPC(固定の相手候補)
  var PARTNER = {
    anonymousLabel: 'お相手 A さん',
    compatibility: 82,
    conversation: {
      timeLabel: '昨夜 2:14 – 2:17 の会話より抜粋',
      turns: [
        { speaker: 'self',    text: 'こんばんは。夜遅くにすみません。休日は外に出るより、家でゆっくりしている方が多いみたいですね。' },
        { speaker: 'partner', text: 'こんばんは。そうなんです。人と会うのは好きなんですが、週末はいったん静かにしないと次の週が持たなくて。' },
        { speaker: 'self',    text: '分かります。うちの人も同じことを言っていました。ちなみに、最近何かに夢中になったことはありますか。' },
        { speaker: 'partner', text: '短い文章を書くのにハマっています。誰に見せるわけでもないんですけど、書いていると気持ちが整理されて。' },
        { speaker: 'self',    text: 'それ、いいですね。うちの人は写真を撮るのが好きで、たぶん似た感覚だと思います。残しておきたい、みたいな。' },
        { speaker: 'partner', text: '確かに近いかもしれません。あと、笑いのツボが合う人だとすごく楽だなと思います。真面目な話ばかりだと疲れてしまって。' },
        { speaker: 'self',    text: 'そこも重なりそうです。ただ、うちの人は将来のことをかなり具体的に考えているタイプなんですが、そのあたりはどうでしょう。' },
        { speaker: 'partner', text: '正直、私はまだこれから考えたい段階です。焦って決めたくない、という感じでしょうか。' },
        { speaker: 'self',    text: 'なるほど。そこは温度差がありますね。ただ、方向が違うわけではなさそうなので、話しながら合わせていけそうです。' }
      ]
    },
    axes: [
      { key: 'flow', label: '会話の弾み', score: 88, invertedGood: false,
        comment: '沈黙がなく、互いに話題を足し合っていました。',
        quote: '「分かります。ちなみに、最近何かに夢中になったことはありますか。」' },
      { key: 'values', label: '価値観の一致', score: 84, invertedGood: false,
        comment: '休日の過ごし方や、大切にしたい時間の使い方が重なっています。',
        quote: '「週末はいったん静かにしないと次の週が持たなくて。」' },
      { key: 'humor', label: 'ユーモアの相性', score: 79, invertedGood: false,
        comment: '軽さを求める姿勢が一致。実際の笑いの相性は対面での確認が必要です。',
        quote: '「笑いのツボが合う人だとすごく楽だなと思います。」' },
      { key: 'interest', label: '相互関心', score: 86, invertedGood: false,
        comment: '一方的にならず、双方が相手に質問を返していました。',
        quote: '「短い文章を書くのにハマっています。」' },
      { key: 'conflict', label: '不一致の重大度', score: 24, invertedGood: true,
        comment: '将来設計の温度差はありますが、方向性の対立ではありません。',
        quote: '「正直、私はまだこれから考えたい段階です。」' }
    ],
    summary: '価値観と生活リズムの重なりが大きく、会話のテンポも自然でした。相違点はありますが、関係を妨げるほどではありません。',
    revealed: {
      name: '山田 花子(仮名)',
      company: '株式会社カリヤ精機',
      department: '品質保証部',
      ageRange: '30代前半',
      message: '文章を書くのが好きです。よろしくお願いします。'
    },
    slots: [
      { id: 'slot1', label: '9月5日(土) 13:00 – 14:00', place: '刈谷市内 カフェ' },
      { id: 'slot2', label: '9月6日(日) 11:00 – 12:00', place: '刈谷市内 カフェ' },
      { id: 'slot3', label: '9月12日(土) 15:00 – 16:00', place: '刈谷駅前 ラウンジ' }
    ]
  };

  // お知らせ
  var NOTIFICATIONS = [
    { id: 'n1', icon: 'bell', title: '新しいマッチ候補がいます',
      body: '相性基準を満たしたペアが見つかりました。', time: '2時間前', target: 'report' },
    { id: 'n2', icon: 'doc', title: '相性レポートが準備できました',
      body: '会話ログと相性レポートを確認できます。', time: '5時間前', target: 'report' }
  ];

  // 5段階ステップインジケーター
  var STEPS = [
    { label: '登録完了',             icon: 'i-check' },
    { label: 'インタビュー完了',     icon: 'i-chat' },
    { label: 'アバターが会話中',     icon: 'i-avatar-pair' },
    { label: '相性が高い時に通知',   icon: 'i-bell' },
    { label: '会話ログを読んで判断', icon: 'i-doc' }
  ];

  /* =======================================================================
     状態管理と永続化
     ======================================================================= */

  var INITIAL_STATE = {
    version: 1,                 // 保存形式のバージョン。不一致時は初期化
    currentScreen: 'invite',    // 現在表示中の画面名
    inviteCode: '',             // 入力された招待コード(検証はしない)
    registered: false,          // 招待コード登録済みか
    answers: [],                // インタビュー回答 [{ id, question, answer, type }]
    interviewDone: false,       // 全6問の回答完了フラグ
    notified: false,            // マッチ通知が発生済みか
    readNotificationIds: [],    // 既読のお知らせID
    decision: null,             // null | 'accept' | 'decline'
    selectedSlotId: null,       // 選択した面談候補日時のID
    scheduled: false,           // 日程調整を送信済みか
    notificationsEnabled: true  // 設定画面のトグル(表示のみ)
  };

  var state = clone(INITIAL_STATE);
  var waitingTimer = null;

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // localStorage が使えない環境(プライベートモード等)でも例外でデモを止めない
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* メモリ上の state のみで動作を継続する */
    }
  }

  function loadState() {
    var raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return clone(INITIAL_STATE);
    }
    if (!raw) { return clone(INITIAL_STATE); }

    var parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      parsed = null;
    }
    // 破損 / バージョン不一致 → キーを消して初期状態から開始
    if (!parsed || typeof parsed !== 'object' || parsed.version !== INITIAL_STATE.version) {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e2) { /* 無視 */ }
      return clone(INITIAL_STATE);
    }
    // 欠けたキーは初期値で補う
    var next = clone(INITIAL_STATE);
    Object.keys(next).forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(parsed, key)) { next[key] = parsed[key]; }
    });
    return next;
  }

  function resetDemo() {
    clearWaitingTimer();
    hideToast();
    closeSheet();
    hideLoading();
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* 無視 */ }
    state = clone(INITIAL_STATE);
    saveState();
    showScreen('invite');
  }

  // ステップインジケーターの状態は state から算出する(重複した状態を持たない)
  function currentStepIndex(s) {
    if (s.decision) { return 4; }       // 会話ログを読んで判断
    if (s.notified) { return 3; }       // 相性が高い時に通知
    if (s.interviewDone) { return 2; }  // アバターが会話中
    if (s.registered) { return 1; }     // インタビュー完了
    return 0;                           // 登録完了
  }

  function clearWaitingTimer() {
    if (waitingTimer !== null) {
      clearTimeout(waitingTimer);
      waitingTimer = null;
    }
  }

  /* =======================================================================
     DOMヘルパー
     ======================================================================= */

  function el(id) { return document.getElementById(id); }

  var ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (c) { return ESCAPE_MAP[c]; });
  }

  /* =======================================================================
     画面遷移
     ======================================================================= */

  var renderers = {};

  function showScreen(name) {
    // 未登録の状態で後続画面へ入られた場合は招待コード画面へ戻す
    if (!state.registered && name !== 'invite') { name = 'invite'; }

    var target = document.querySelector('.screen[data-screen="' + name + '"]');
    if (!target) { return; }

    // 待機画面から離れるときはタイマーを止める
    if (name !== 'waiting') { clearWaitingTimer(); }

    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) { screens[i].classList.remove('is-active'); }
    target.classList.add('is-active');

    state.currentScreen = name;
    saveState();

    el('viewport').scrollTop = 0;

    if (renderers[name]) { renderers[name](); }

    updateChrome(name);

    var head = target.querySelector('[data-autofocus]') || target;
    head.focus({ preventScroll: true });
  }

  /* =======================================================================
     共通シェル(ヘッダー / タブバー / トースト / 確認シート / ローディング)
     ======================================================================= */

  // ヘッダーと下部タブバーを出さない画面(オンボーディングの一本道感を出す)
  var CHROME_HIDDEN_SCREENS = ['invite', 'interview'];

  // 画面名 → アクティブにする下部タブ
  var TAB_FOR_SCREEN = {
    home: 'home',
    mypage: 'mypage',
    notifications: 'messages',
    profile: 'profile'
  };

  function updateChrome(name) {
    var showChrome = state.registered && CHROME_HIDDEN_SCREENS.indexOf(name) === -1;
    el('appHeader').hidden = !showChrome;
    el('tabBar').hidden = !showChrome;

    var activeTab = TAB_FOR_SCREEN[name] || null;
    var tabs = el('tabBar').querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      var isActive = tabs[i].getAttribute('data-tab') === activeTab;
      tabs[i].classList.toggle('is-active', isActive);
      if (isActive) { tabs[i].setAttribute('aria-current', 'page'); }
      else { tabs[i].removeAttribute('aria-current'); }
    }

    updateBellBadge();
  }

  function unreadCount() {
    return NOTIFICATIONS.filter(function (n) {
      return state.readNotificationIds.indexOf(n.id) === -1;
    }).length;
  }

  function updateBellBadge() {
    var count = state.notified ? unreadCount() : 0;
    var badge = el('bellBadge');
    badge.textContent = String(count);
    badge.hidden = count === 0;
    el('bellButton').setAttribute('aria-label', count > 0 ? 'お知らせ 未読' + count + '件' : 'お知らせ');
  }

  function markNotificationRead(id) {
    if (state.readNotificationIds.indexOf(id) === -1) {
      state.readNotificationIds.push(id);
      saveState();
    }
    updateBellBadge();
  }

  /* ----- トースト(通知バナー) ----- */

  var toastTimer = null;
  var toastHideTimer = null;

  function showToast(text, onTap) {
    // 直前の非表示タイマーが後から発火して新しいトーストを隠すレースを防ぐ
    clearTimeout(toastHideTimer);
    var toast = el('toast');
    var button = el('toastButton');
    button.querySelector('.toast__text').textContent = text;
    toast.hidden = false;
    // hidden 解除の直後にクラスを付けてスライドインさせる
    requestAnimationFrame(function () { toast.classList.add('is-visible'); });
    button.onclick = function () {
      hideToast();
      if (onTap) { onTap(); }
    };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 4000);
  }

  function hideToast() {
    clearTimeout(toastTimer);
    var toast = el('toast');
    toast.classList.remove('is-visible');
    clearTimeout(toastHideTimer);
    toastHideTimer = setTimeout(function () { toast.hidden = true; }, 300);
  }

  /* ----- 確認シート(window.confirm は使わない) ----- */

  var sheetOnConfirm = null;

  function openSheet(options) {
    el('sheetTitle').textContent = options.title;
    el('sheetMessage').textContent = options.message;
    var confirmButton = el('sheetConfirm');
    confirmButton.textContent = options.confirmLabel;
    confirmButton.classList.toggle('is-danger', options.danger === true);
    sheetOnConfirm = options.onConfirm || null;
    el('sheet').hidden = false;
    el('sheetTitle').focus({ preventScroll: true });
  }

  function closeSheet() {
    el('sheet').hidden = true;
    sheetOnConfirm = null;
  }

  /* ----- ローディング演出 ----- */

  function showLoading(text) {
    el('loadingText').textContent = text;
    el('loading').hidden = false;
  }

  function hideLoading() {
    el('loading').hidden = true;
  }

  function initShell() {
    el('bellButton').addEventListener('click', function () { showScreen('notifications'); });
    el('sheetCancel').addEventListener('click', closeSheet);
    el('sheetBackdrop').addEventListener('click', closeSheet);
    el('sheetConfirm').addEventListener('click', function () {
      var callback = sheetOnConfirm;
      closeSheet();
      if (callback) { callback(); }
    });
  }

  /* =======================================================================
     [1] 招待コード入力画面
     ======================================================================= */

  renderers.invite = function () {
    var input = el('inviteInput');
    input.value = state.inviteCode || '';
    input.classList.remove('is-error');
    el('inviteError').hidden = true;
  };

  function submitInviteCode() {
    var input = el('inviteInput');
    var value = input.value.trim();

    // 唯一のバリデーション: 空欄または空白のみは通さない
    if (value === '') {
      el('inviteError').hidden = false;
      input.classList.add('is-error');
      input.focus();
      return;
    }

    // 空欄でなければ、どんな文字列でも通す(形式・長さ・大文字小文字の検証は行わない)
    state.inviteCode = value;
    state.registered = true;
    saveState();
    showScreen('interview');
  }

  function initInviteScreen() {
    var input = el('inviteInput');

    input.addEventListener('input', function () {
      el('inviteError').hidden = true;
      input.classList.remove('is-error');
    });

    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && !event.isComposing) { submitInviteCode(); }
    });

    el('inviteSubmit').addEventListener('click', submitInviteCode);
  }

  /* =======================================================================
     [2] AIインタビュー画面
     ======================================================================= */

  var INTERVIEW_INTRO = 'はじめまして。あなたのAIアバターです。これから6つだけ質問させてください。あなたの答え方や考え方を学んで、私があなたの代わりに相手と話します。';
  var INTERVIEW_OUTRO = 'ありがとうございます。あなたのことが分かってきました。あとは私にまかせて、ゆっくり休んでください。';

  var interviewTimer = null;

  function bubbleHTML(side, text) {
    return '<div class="bubble bubble--' + side + '">' + esc(text) + '</div>';
  }

  function scrollViewportToBottom() {
    var viewport = el('viewport');
    viewport.scrollTop = viewport.scrollHeight;
  }

  renderers.interview = function () {
    clearTimeout(interviewTimer);

    var answered = state.answers.length;
    var question = QUESTIONS[answered] || null;

    // 導入メッセージ → 回答済みの履歴 → 現在の質問(または締めのメッセージ)
    var html = bubbleHTML('ai', INTERVIEW_INTRO);
    state.answers.forEach(function (item) {
      html += bubbleHTML('ai', item.question);
      html += bubbleHTML('self', item.answer);
    });

    if (question) {
      html += bubbleHTML('ai', question.text);
      if (question.type === 'choice') {
        html += '<div class="choices">' + question.options.map(function (option, index) {
          return '<button type="button" class="choice" data-option="' + index + '">' + esc(option) + '</button>';
        }).join('') + '</div>';
      }
    } else {
      html += bubbleHTML('ai', INTERVIEW_OUTRO);
    }

    el('interviewChat').innerHTML = html;

    el('interviewProgress').textContent =
      (question ? answered + 1 : QUESTIONS.length) + ' / ' + QUESTIONS.length;
    el('interviewProgressBar').style.width =
      Math.round((answered / QUESTIONS.length) * 100) + '%';

    var textInput = el('interviewText');
    textInput.value = '';
    el('interviewSend').disabled = true;

    // 自由記述の設問のときだけ入力欄を出す。全問回答後だけ完了ボタンを出す
    el('interviewInput').hidden = !(question && question.type === 'free');
    el('interviewActions').hidden = question !== null;

    scrollViewportToBottom();
  };

  function submitInterviewAnswer(answer) {
    var index = state.answers.length;
    var question = QUESTIONS[index];
    if (!question) { return; }

    state.answers.push({
      id: question.id,
      question: question.text,
      answer: answer,
      type: question.type
    });
    saveState();

    // 自分の吹き出しを即時追加し、タイピング演出をはさんでから次の質問を描画する
    var chat = el('interviewChat');
    var choices = chat.querySelector('.choices');
    if (choices) { choices.remove(); }
    chat.insertAdjacentHTML('beforeend', bubbleHTML('self', answer));
    chat.insertAdjacentHTML('beforeend',
      '<div class="bubble bubble--ai bubble--typing"><span></span><span></span><span></span></div>');
    el('interviewInput').hidden = true;
    scrollViewportToBottom();

    interviewTimer = setTimeout(function () { renderers.interview(); }, 600);
  }

  function initInterviewScreen() {
    el('interviewChat').addEventListener('click', function (event) {
      var button = event.target.closest('.choice');
      if (!button) { return; }
      var question = QUESTIONS[state.answers.length];
      if (!question || question.type !== 'choice') { return; }
      submitInterviewAnswer(question.options[Number(button.getAttribute('data-option'))]);
    });

    var textInput = el('interviewText');

    textInput.addEventListener('input', function () {
      // 空欄(空白のみ)では送信できない
      el('interviewSend').disabled = textInput.value.trim() === '';
    });

    textInput.addEventListener('keydown', function (event) {
      // IME変換確定のEnterでは送信しない(isComposing中は無視)
      if (event.key === 'Enter' && !event.isComposing && textInput.value.trim() !== '') {
        submitInterviewAnswer(textInput.value.trim());
      }
    });

    el('interviewSend').addEventListener('click', function () {
      var value = textInput.value.trim();
      if (value !== '') { submitInterviewAnswer(value); }
    });

    el('interviewFinish').addEventListener('click', function () {
      state.interviewDone = true;
      saveState();
      showScreen('waiting');
    });
  }

  /* =======================================================================
     ヒーローカード / ステップインジケーター(待機画面とホーム画面で共有)
     ======================================================================= */

  // withHotspot: true のとき、右下に隠しショートカット領域を含める(待機画面のみ)
  function heroCardHTML(withHotspot) {
    return '' +
      '<div class="hero">' +
        '<div class="hero__text">' +
          '<h1 class="hero-title" data-autofocus tabindex="-1">AIが代わりに会っている。</h1>' +
          '<p class="hero__lead">あなたのAIアバターが相手のアバターと会話し、相性を確かめています。</p>' +
        '</div>' +
        '<div class="hero__art">' +
          '<svg class="icon hero__icon" aria-hidden="true" focusable="false"><use href="#i-avatar-pair"></use></svg>' +
        '</div>' +
        (withHotspot ? '<span class="hero__hotspot" id="waitingHotspot" aria-hidden="true"></span>' : '') +
      '</div>';
  }

  function stepsHTML() {
    var current = currentStepIndex(state);
    return '<ol class="steps">' + STEPS.map(function (step, index) {
      var status = index < current ? 'done' : (index === current ? 'current' : 'todo');
      var iconId = index < current ? 'i-check' : step.icon;
      return '<li class="step step--' + status + '">' +
               '<span class="step__mark"><svg class="icon" aria-hidden="true" focusable="false"><use href="#' + iconId + '"></use></svg></span>' +
               '<span class="step__label">' + esc(step.label) + '</span>' +
             '</li>';
    }).join('') + '</ol>';
  }

  /* =======================================================================
     [3] アバター会話中(待機)画面
     ======================================================================= */

  function startWaitingTimer() {
    clearWaitingTimer();
    waitingTimer = setTimeout(completeWaiting, 6000);
  }

  function completeWaiting() {
    clearWaitingTimer();
    if (state.notified) { return; }

    state.notified = true;
    saveState();

    if (state.currentScreen === 'waiting') { renderers.waiting(); }
    updateBellBadge();
    showToast('新しいマッチ候補がいます', function () { showScreen('report'); });
  }

  // 展示会での事故防止として、ヒーローカード右下の目立たない領域の長押し(700ms)で
  // 待機を即座に完了させる。対象領域を絞って誤発火を防ぐ
  function attachWaitingShortcut() {
    var hotspot = el('waitingHotspot');
    if (!hotspot) { return; }

    var pressTimer = null;
    function startPress() {
      clearTimeout(pressTimer);
      pressTimer = setTimeout(completeWaiting, 700);
    }
    function cancelPress() { clearTimeout(pressTimer); }

    hotspot.addEventListener('pointerdown', startPress);
    hotspot.addEventListener('pointerup', cancelPress);
    hotspot.addEventListener('pointerleave', cancelPress);
    hotspot.addEventListener('pointercancel', cancelPress);
  }

  renderers.waiting = function () {
    el('waitingBody').innerHTML =
      heroCardHTML(true) +
      '<div class="card status-card">' +
        '<div class="status-card__head">' +
          '<span class="icon-circle status-card__pulse"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-avatar-pair"></use></svg></span>' +
          '<div>' +
            '<p class="card-title">アバターが会話中です</p>' +
            '<p class="text-body">あなたのアバターが、複数の候補アバターと会話を進めています。</p>' +
          '</div>' +
        '</div>' +
        stepsHTML() +
      '</div>' +
      '<p class="text-note">相性の基準を満たしたときだけ通知が届きます。基準に満たない場合は、何も起きません。</p>' +
      (state.notified
        ? '<button type="button" class="btn btn--primary waiting__cta" id="waitingToNotifications">お知らせを見る</button>'
        : '');

    if (state.notified) {
      el('waitingToNotifications').addEventListener('click', function () { showScreen('notifications'); });
    }

    attachWaitingShortcut();

    // 通知済みなら演出を再生せず、通知済みの表示状態で描画するだけにする
    if (!state.notified) { startWaitingTimer(); }
  };

  /* =======================================================================
     [4] お知らせ一覧画面
     ======================================================================= */

  renderers.notifications = function () {
    var body = el('notificationsBody');

    // 未通知のときはリストの代わりに空状態を出す(例外を投げない)
    if (!state.notified) {
      body.innerHTML =
        '<div class="card empty">' +
          '<span class="icon-circle"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-bell"></use></svg></span>' +
          '<p class="text-body">まだお知らせはありません。アバターが会話を続けています。</p>' +
        '</div>';
      return;
    }

    body.innerHTML = NOTIFICATIONS.map(function (item) {
      var unread = state.readNotificationIds.indexOf(item.id) === -1;
      return '<button type="button" class="card notice' + (unread ? ' is-unread' : '') + '" data-notification="' + item.id + '">' +
               '<span class="icon-circle"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-' + item.icon + '"></use></svg></span>' +
               '<span class="notice__body">' +
                 '<span class="notice__title">' +
                   (unread ? '<span class="notice__dot" aria-hidden="true"></span><span class="sr-only">未読</span>' : '') +
                   esc(item.title) +
                 '</span>' +
                 '<span class="notice__text">' + esc(item.body) + '</span>' +
                 '<span class="notice__time">' + esc(item.time) + '</span>' +
               '</span>' +
               '<svg class="icon notice__chevron" aria-hidden="true" focusable="false"><use href="#i-chevron"></use></svg>' +
             '</button>';
    }).join('');
  };

  function initNotificationsScreen() {
    el('notificationsBody').addEventListener('click', function (event) {
      var button = event.target.closest('[data-notification]');
      if (!button) { return; }
      // デモの単純化のため、どちらのカードも遷移先は report
      markNotificationRead(button.getAttribute('data-notification'));
      showScreen('report');
    });
  }

  /* =======================================================================
     [5] 会話ログ・相性レポート画面
     ======================================================================= */

  function partnerHeaderHTML() {
    return '' +
      '<div class="card partner">' +
        '<div class="partner__row">' +
          '<span class="icon-circle icon-circle--lg"><svg class="icon icon--lg" aria-hidden="true" focusable="false"><use href="#i-user"></use></svg></span>' +
          '<div class="partner__meta">' +
            '<h1 class="partner__name" data-autofocus tabindex="-1">' + esc(PARTNER.anonymousLabel) + '</h1>' +
            '<p class="partner__sub">実名・所属は非表示です</p>' +
          '</div>' +
          '<span class="badge">相性 ' + PARTNER.compatibility + '%</span>' +
        '</div>' +
        '<p class="text-note">※お互いが「会う」を選ぶまで、実名・所属は表示されません。</p>' +
      '</div>';
  }

  function logBubbleHTML(turn) {
    var isSelf = turn.speaker === 'self';
    return '<div class="bubble bubble--' + (isSelf ? 'self' : 'ai') + '">' +
             '<span class="bubble__who">' + (isSelf ? 'あなたのアバター' : 'お相手のアバター') + '</span>' +
             esc(turn.text) +
           '</div>';
  }

  function conversationHTML() {
    return '' +
      '<div class="card log">' +
        '<h2 class="section-title log__title">' + esc(PARTNER.conversation.timeLabel) + '</h2>' +
        '<div class="chat chat--log">' + PARTNER.conversation.turns.map(logBubbleHTML).join('') + '</div>' +
        '<p class="text-note">これは、あなたが寝ている間にAIアバター同士が交わした会話です。</p>' +
      '</div>';
  }

  function axesHTML() {
    return '<h2 class="section-title">相性レポート</h2>' + PARTNER.axes.map(function (axis) {
      return '<div class="card axis">' +
               '<div class="axis__head">' +
                 '<span class="axis__label">' + esc(axis.label) +
                   (axis.invertedGood ? '<span class="axis__hint">低いほど良い</span>' : '') +
                 '</span>' +
                 '<span class="axis__score">' + axis.score + '</span>' +
               '</div>' +
               '<div class="bar" role="img" aria-label="' + esc(axis.label) + ' ' + axis.score + ' / 100">' +
                 '<div class="bar__fill' + (axis.invertedGood ? ' bar__fill--neutral' : '') + '" data-score="' + axis.score + '"></div>' +
               '</div>' +
               '<p class="text-body axis__comment">' + esc(axis.comment) + '</p>' +
               '<p class="axis__quote">' + esc(axis.quote) + '</p>' +
             '</div>';
    }).join('');
  }

  function summaryHTML() {
    return '<div class="card">' +
             '<h2 class="section-title section-title--flush">総評</h2>' +
             '<p class="text-body">' + esc(PARTNER.summary) + '</p>' +
           '</div>';
  }

  function decisionHTML() {
    if (state.decision === 'accept') {
      return '<div class="card decision">' +
               '<p class="card-title">あなたは「会う」を選択済みです</p>' +
               '<button type="button" class="btn btn--primary" data-go="reveal">開示情報を見る</button>' +
             '</div>';
    }
    return '<div class="card decision">' +
             '<p class="text-note decision__note">あなたの判断は相手には通知されません。両者が「会う」を選んだ場合のみ、お互いに開示されます。</p>' +
             '<button type="button" class="btn btn--primary" id="reportAccept">会う</button>' +
             '<button type="button" class="btn btn--secondary" id="reportDecline">今回は辞退する</button>' +
           '</div>';
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // 表示時に width を 0 から目標値へトランジションさせる。
  // reduce 指定時は最終状態を即座に適用する
  function animateBars() {
    var fills = el('reportBody').querySelectorAll('.bar__fill');

    function apply() {
      for (var i = 0; i < fills.length; i++) {
        fills[i].style.width = fills[i].getAttribute('data-score') + '%';
      }
    }

    if (prefersReducedMotion()) { apply(); return; }
    requestAnimationFrame(apply);
  }

  function acceptMatch() {
    state.decision = 'accept';
    saveState();
    showLoading('お相手も「会う」を選んでいます');
    setTimeout(function () {
      hideLoading();
      showScreen('reveal');
    }, 800);
  }

  function declineMatch() {
    openSheet({
      title: '辞退の確認',
      message: '辞退すると、このお相手の情報は表示されなくなります。よろしいですか?',
      confirmLabel: '辞退する',
      danger: true,
      onConfirm: function () {
        state.decision = 'decline';
        saveState();
        showScreen('declined');
      }
    });
  }

  renderers.report = function () {
    var body = el('reportBody');

    // 未通知でこの画面に来た場合は空状態を出す(例外を投げない)
    if (!state.notified) {
      body.innerHTML =
        '<h1 class="screen-title" data-autofocus tabindex="-1">相性レポート</h1>' +
        '<div class="card empty">' +
          '<p class="text-body">まだレポートはありません。アバターが会話を続けています。</p>' +
          '<button type="button" class="btn btn--secondary" data-go="home">ホームに戻る</button>' +
        '</div>';
      return;
    }

    body.innerHTML =
      partnerHeaderHTML() +
      conversationHTML() +
      axesHTML() +
      summaryHTML() +
      decisionHTML();

    var accept = el('reportAccept');
    if (accept) { accept.addEventListener('click', acceptMatch); }
    var decline = el('reportDecline');
    if (decline) { decline.addEventListener('click', declineMatch); }

    animateBars();
  };

  function initReportScreen() {
    el('declinedReopen').addEventListener('click', function () {
      // デモ復帰用: 判断を取り消してレポートへ戻る
      state.decision = null;
      saveState();
      showScreen('report');
    });
  }

  /* =======================================================================
     [6] 実名開示画面
     ======================================================================= */

  renderers.reveal = function () {
    var body = el('revealBody');

    // 「会う」を選ぶ前にこの画面へ来た場合は空状態を出す(例外を投げない)
    if (state.decision !== 'accept') {
      body.innerHTML =
        '<h1 class="screen-title" data-autofocus tabindex="-1">開示情報</h1>' +
        '<div class="card empty">' +
          '<p class="text-body">まだ開示できる情報はありません。相性レポートで「会う」を選ぶと表示されます。</p>' +
          '<button type="button" class="btn btn--secondary" data-go="home">ホームに戻る</button>' +
        '</div>';
      return;
    }

    var revealed = PARTNER.revealed;

    body.innerHTML =
      '<h1 class="screen-title" data-autofocus tabindex="-1">お互いが「会う」を選びました</h1>' +
      '<div class="card reveal-card" id="revealCard">' +
        '<span class="icon-circle icon-circle--lg"><svg class="icon icon--lg" aria-hidden="true" focusable="false"><use href="#i-user"></use></svg></span>' +
        '<dl class="reveal-list">' +
          '<div class="reveal-row"><dt>氏名</dt><dd>' + esc(revealed.name) + '</dd></div>' +
          '<div class="reveal-row"><dt>所属</dt><dd>' + esc(revealed.company) + ' / ' + esc(revealed.department) + '</dd></div>' +
          '<div class="reveal-row"><dt>年代</dt><dd>' + esc(revealed.ageRange) + '</dd></div>' +
          '<div class="reveal-row"><dt>一言</dt><dd>' + esc(revealed.message) + '</dd></div>' +
        '</dl>' +
      '</div>' +
      '<h2 class="section-title">面談候補日時</h2>' +
      PARTNER.slots.map(function (slot) {
        var selected = state.selectedSlotId === slot.id;
        return '<button type="button" class="card slot' + (selected ? ' is-selected' : '') + '" ' +
                 'data-slot="' + slot.id + '" aria-pressed="' + (selected ? 'true' : 'false') + '">' +
                 '<span class="icon-circle"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-calendar"></use></svg></span>' +
                 '<span class="slot__body">' +
                   '<span class="slot__label">' + esc(slot.label) + '</span>' +
                   '<span class="slot__place">' + esc(slot.place) + '</span>' +
                 '</span>' +
               '</button>';
      }).join('') +
      '<button type="button" class="btn btn--primary reveal__cta" id="revealSchedule"' +
        (state.selectedSlotId ? '' : ' disabled') + '>この日時で調整する</button>' +
      '<p class="text-note">開示された情報は、お二人以外には共有されません。人事・運営がこの内容を閲覧することはありません。</p>';

    // 下からフェードイン+わずかにスライドアップ(約600ms)。
    // reduce 指定時は最終状態を即座に適用する
    if (prefersReducedMotion()) {
      el('revealCard').classList.add('is-shown');
    } else {
      requestAnimationFrame(function () { el('revealCard').classList.add('is-shown'); });
    }

    var slotButtons = body.querySelectorAll('[data-slot]');
    for (var i = 0; i < slotButtons.length; i++) {
      slotButtons[i].addEventListener('click', function (event) {
        var button = event.currentTarget;
        state.selectedSlotId = button.getAttribute('data-slot');
        saveState();
        // 開示カードの演出を再生し直さないよう、選択状態だけを差し替える
        for (var j = 0; j < slotButtons.length; j++) {
          var isSelected = slotButtons[j].getAttribute('data-slot') === state.selectedSlotId;
          slotButtons[j].classList.toggle('is-selected', isSelected);
          slotButtons[j].setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        }
        el('revealSchedule').disabled = false;
      });
    }

    el('revealSchedule').addEventListener('click', function () {
      if (!state.selectedSlotId) { return; }
      state.scheduled = true;
      saveState();
      showScreen('done');
    });
  };

  /* =======================================================================
     [H] ホーム画面
     ======================================================================= */

  // メニューグリッド(4列 横1行)
  var HOME_MENU = [
    { icon: 'i-doc',    label: '会話ログ・相性レポート', target: 'report' },
    { icon: 'i-shield', label: 'プライバシーについて',   target: 'privacy' },
    { icon: 'i-help',   label: 'よくある質問',           target: 'faq' },
    { icon: 'i-gear',   label: '設定',                   target: 'settings' }
  ];

  function statusText() {
    if (state.decision === 'accept') { return 'お相手と面談日程を調整できます。'; }
    if (state.decision === 'decline') { return '辞退しました。アバターは引き続き会話を続けています。'; }
    if (state.notified) { return '相性の高いお相手が見つかりました。会話ログと相性レポートを確認できます。'; }
    return 'あなたのアバターが、複数の候補アバターと会話を進めています。';
  }

  function statusActionLabel() {
    return state.notified ? '相性レポートを見る' : '進行状況を見る';
  }

  function statusTargetScreen() {
    return state.notified ? 'report' : 'waiting';
  }

  function homeNoticeCardHTML() {
    var rows = state.notified
      ? NOTIFICATIONS.slice(0, 2).map(function (item) {
          return '<button type="button" class="notice-row" data-home-notification="' + item.id + '">' +
                   '<span class="icon-circle"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-' + item.icon + '"></use></svg></span>' +
                   '<span class="notice-row__body">' +
                     '<span class="card-title">' + esc(item.title) + '</span>' +
                     '<span class="notice__time">' + esc(item.time) + '</span>' +
                   '</span>' +
                   '<svg class="icon notice__chevron" aria-hidden="true" focusable="false"><use href="#i-chevron"></use></svg>' +
                 '</button>';
        }).join('')
      : '<p class="text-body">まだお知らせはありません。</p>';

    return '<div class="card">' +
             '<div class="card__head">' +
               '<h2 class="section-title section-title--flush">お知らせ</h2>' +
               '<button type="button" class="btn-link" data-go="notifications">すべて見る &gt;</button>' +
             '</div>' +
             rows +
           '</div>';
  }

  function menuGridHTML() {
    return '<div class="menu-grid">' + HOME_MENU.map(function (item) {
      return '<button type="button" class="menu-item" data-go="' + item.target + '">' +
               '<span class="icon-circle"><svg class="icon" aria-hidden="true" focusable="false"><use href="#' + item.icon + '"></use></svg></span>' +
               '<span class="menu-item__label">' + esc(item.label) + '</span>' +
             '</button>';
    }).join('') + '</div>';
  }

  renderers.home = function () {
    var body = el('homeBody');

    body.innerHTML =
      heroCardHTML(false) +
      '<div class="card status-card">' +
        '<div class="status-card__head">' +
          '<span class="icon-circle"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-avatar-pair"></use></svg></span>' +
          '<div>' +
            '<p class="card-title">現在の状況</p>' +
            '<p class="text-body">' + esc(statusText()) + '</p>' +
          '</div>' +
        '</div>' +
        stepsHTML() +
        '<button type="button" class="btn btn--secondary home__status-cta" id="homeStatusGo">' + esc(statusActionLabel()) + '</button>' +
      '</div>' +
      homeNoticeCardHTML() +
      menuGridHTML() +
      '<button type="button" class="card banner" data-go="privacy">' +
        '<span class="icon-circle"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-lock"></use></svg></span>' +
        '<span class="banner__body">' +
          '<span class="card-title">安心・匿名の設計</span>' +
          '<span class="text-body">実名や所属は、あなたとお相手がOKした後にのみ開示されます。人事や運営がマッチ内容を見ることはできません。</span>' +
        '</span>' +
      '</button>';

    el('homeStatusGo').addEventListener('click', function () {
      showScreen(statusTargetScreen());
    });

    var noticeRows = body.querySelectorAll('[data-home-notification]');
    for (var i = 0; i < noticeRows.length; i++) {
      noticeRows[i].addEventListener('click', function (event) {
        markNotificationRead(event.currentTarget.getAttribute('data-home-notification'));
        showScreen('report');
      });
    }
  };

  /* =======================================================================
     [M] マイページ / [S] 設定
     ======================================================================= */

  renderers.mypage = function () {
    var stepLabel = STEPS[currentStepIndex(state)].label;

    var answersHTML = state.answers.length === 0
      ? '<div class="card"><p class="text-body">まだ回答がありません。</p></div>'
      : state.answers.map(function (item) {
          return '<div class="card qa">' +
                   '<p class="qa__q">' + esc(item.question) + '</p>' +
                   '<p class="qa__a">' + esc(item.answer) + '</p>' +
                 '</div>';
        }).join('');

    el('mypageBody').innerHTML =
      '<div class="card">' +
        '<p class="card-title">現在のステップ</p>' +
        '<p class="text-body">' + esc(stepLabel) + '</p>' +
      '</div>' +
      '<h2 class="section-title">インタビューの回答</h2>' +
      answersHTML;
  };

  renderers.settings = function () {
    el('settingsNotify').checked = state.notificationsEnabled === true;
  };

  function initSettingsScreen() {
    el('settingsNotify').addEventListener('change', function (event) {
      // 見た目のみ。state には保存するが挙動には影響しない
      state.notificationsEnabled = event.target.checked;
      saveState();
    });

    el('settingsReset').addEventListener('click', function () {
      openSheet({
        title: 'デモをリセット',
        message: '保存されたデモの進行状況をすべて削除して、最初からやり直します。よろしいですか?',
        confirmLabel: 'リセットする',
        danger: true,
        onConfirm: resetDemo
      });
    });
  }

  /* =======================================================================
     ブラウザ離脱防止ガード(§7.2)
     画面遷移に履歴APIは使わない。戻る/スワイプバックでの離脱のみを防ぐ
     ======================================================================= */

  function installBackGuard() {
    history.pushState(null, '', location.href);
    window.addEventListener('popstate', function () {
      history.pushState(null, '', location.href);
    });
  }

  /* =======================================================================
     端末枠のスケーリング
     ======================================================================= */

  function fitPhone() {
    var scale = Math.min(
      1,
      (window.innerHeight - 24) / 812,
      (window.innerWidth - 24) / 375
    );
    document.documentElement.style.setProperty('--phone-scale', String(Math.max(0.3, scale)));
  }

  /* =======================================================================
     初期化
     ======================================================================= */

  function init() {
    state = loadState();

    fitPhone();
    window.addEventListener('resize', fitPhone);
    // file:// 等の環境では history.pushState が SecurityError を投げることがある。
    // ここで例外を握りつぶし、離脱防止ガードが使えなくてもアプリ本体は起動できるようにする。
    try { installBackGuard(); } catch (e) {}
    try { initShell(); } catch (e) {}
    initInviteScreen();
    initInterviewScreen();
    initNotificationsScreen();
    initReportScreen();
    initSettingsScreen();

    // data-go="画面名" を持つ要素は共通で画面遷移する
    document.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-go]');
      if (trigger) { showScreen(trigger.getAttribute('data-go')); }
    });

    showScreen(state.currentScreen || 'invite');
  }

  // 展示会での緊急操作用
  window.__demo = {
    reset: resetDemo,
    showScreen: showScreen,
    get state() { return state; }
  };

  document.addEventListener('DOMContentLoaded', init);
})();
