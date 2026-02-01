// ゲーム設定
const CONFIG = {
    // 満タンに必要なエネルギー
    MAX_ENERGY: 100,

    // 1クリックあたりの基本充電量（この範囲でランダム）
    MIN_CHARGE_PER_CLICK: 0.8,
    MAX_CHARGE_PER_CLICK: 1.2,

    // 自然放電（毎秒減少する量）
    DISCHARGE_RATE: 0.5,

    // 連打ボーナス設定
    COMBO_THRESHOLD_MS: 200,  // この時間以内のクリックでコンボ
    COMBO_BONUS: 0.3,         // コンボ時の追加充電量
    MAX_COMBO_MULTIPLIER: 2.0, // 最大コンボ倍率

    // ゲーム更新間隔（ミリ秒）
    UPDATE_INTERVAL: 50,
};

// ゲーム状態
let gameState = {
    energy: 0,
    isPlaying: false,
    startTime: null,
    lastClickTime: null,
    comboCount: 0,
    timerInterval: null,
    dischargeInterval: null,
};

// DOM要素
const elements = {
    batteryLevel: document.getElementById('batteryLevel'),
    batteryPercentage: document.getElementById('batteryPercentage'),
    heartArea: document.getElementById('heartArea'),
    timer: document.getElementById('timer'),
    startScreen: document.getElementById('startScreen'),
    countdownScreen: document.getElementById('countdownScreen'),
    countdownNumber: document.getElementById('countdownNumber'),
    playScreen: document.getElementById('playScreen'),
    resultScreen: document.getElementById('resultScreen'),
    resultTime: document.getElementById('resultTime'),
    startBtn: document.getElementById('startBtn'),
    chargeBtn: document.getElementById('chargeBtn'),
    replayBtn: document.getElementById('replayBtn'),
    gameContainer: document.querySelector('.game-container'),
};

// 画面切り替え
function showScreen(screenName) {
    elements.startScreen.classList.add('hidden');
    elements.countdownScreen.classList.add('hidden');
    elements.playScreen.classList.add('hidden');
    elements.resultScreen.classList.add('hidden');

    switch (screenName) {
        case 'start':
            elements.startScreen.classList.remove('hidden');
            break;
        case 'countdown':
            elements.countdownScreen.classList.remove('hidden');
            break;
        case 'play':
            elements.playScreen.classList.remove('hidden');
            break;
        case 'result':
            elements.resultScreen.classList.remove('hidden');
            break;
    }
}

// 電池レベルの更新
function updateBatteryDisplay() {
    const percentage = Math.min(100, Math.max(0, gameState.energy));
    elements.batteryLevel.style.height = percentage + '%';
    elements.batteryPercentage.textContent = Math.floor(percentage) + '%';

    // 色の変更
    elements.batteryLevel.classList.remove('low', 'medium', 'high');
    if (percentage < 30) {
        elements.batteryLevel.classList.add('low');
    } else if (percentage < 70) {
        elements.batteryLevel.classList.add('medium');
    } else {
        elements.batteryLevel.classList.add('high');
    }
}

// タイマー表示の更新
function updateTimerDisplay() {
    if (gameState.startTime) {
        const elapsed = (Date.now() - gameState.startTime) / 1000;
        elements.timer.textContent = `タイム: ${elapsed.toFixed(2)}秒`;
    }
}

// ハートアニメーション生成
function createHeart() {
    const heart = document.createElement('div');
    heart.classList.add('heart');
    heart.textContent = '♥';

    // ランダムな横位置
    const randomX = Math.random() * 80 + 10; // 10% ~ 90%
    heart.style.left = randomX + '%';

    elements.heartArea.appendChild(heart);

    // アニメーション終了後に削除
    setTimeout(() => {
        heart.remove();
    }, 800);
}

// 画面シェイク
function shakeScreen() {
    elements.gameContainer.classList.add('shake');
    setTimeout(() => {
        elements.gameContainer.classList.remove('shake');
    }, 100);
}

// 充電処理
function charge() {
    if (!gameState.isPlaying) return;

    const now = Date.now();

    // 基本充電量（ランダム）
    let chargeAmount = CONFIG.MIN_CHARGE_PER_CLICK +
        Math.random() * (CONFIG.MAX_CHARGE_PER_CLICK - CONFIG.MIN_CHARGE_PER_CLICK);

    // コンボ判定
    if (gameState.lastClickTime && (now - gameState.lastClickTime) < CONFIG.COMBO_THRESHOLD_MS) {
        gameState.comboCount++;
        const comboMultiplier = Math.min(
            CONFIG.MAX_COMBO_MULTIPLIER,
            1 + (gameState.comboCount * CONFIG.COMBO_BONUS)
        );
        chargeAmount *= comboMultiplier;
    } else {
        gameState.comboCount = 0;
    }

    gameState.lastClickTime = now;
    gameState.energy += chargeAmount;

    // エフェクト
    createHeart();
    shakeScreen();
    updateBatteryDisplay();

    // 満タン判定
    if (gameState.energy >= CONFIG.MAX_ENERGY) {
        gameComplete();
    }
}

// 自然放電
function discharge() {
    if (!gameState.isPlaying) return;

    gameState.energy -= CONFIG.DISCHARGE_RATE * (CONFIG.UPDATE_INTERVAL / 1000);
    gameState.energy = Math.max(0, gameState.energy);
    updateBatteryDisplay();
}

// ゲーム開始
function startGame() {
    // 状態リセット
    gameState.energy = 0;
    gameState.isPlaying = false;
    gameState.startTime = null;
    gameState.lastClickTime = null;
    gameState.comboCount = 0;

    updateBatteryDisplay();
    elements.timer.textContent = 'タイム: 0.00秒';

    // カウントダウン開始
    showScreen('countdown');

    let count = 3;
    elements.countdownNumber.textContent = count;

    const countdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
            elements.countdownNumber.textContent = count;
            // アニメーションリセット
            elements.countdownNumber.style.animation = 'none';
            elements.countdownNumber.offsetHeight; // リフロー強制
            elements.countdownNumber.style.animation = 'pulse 0.5s ease-in-out';
        } else {
            clearInterval(countdownInterval);
            elements.countdownNumber.textContent = 'START!';
            setTimeout(() => {
                beginPlay();
            }, 500);
        }
    }, 1000);
}

// プレイ開始
function beginPlay() {
    showScreen('play');
    gameState.isPlaying = true;
    gameState.startTime = Date.now();

    // タイマー更新開始
    gameState.timerInterval = setInterval(() => {
        updateTimerDisplay();
    }, CONFIG.UPDATE_INTERVAL);

    // 自然放電開始
    gameState.dischargeInterval = setInterval(() => {
        discharge();
    }, CONFIG.UPDATE_INTERVAL);
}

// ゲーム完了
function gameComplete() {
    gameState.isPlaying = false;

    // インターバル停止
    clearInterval(gameState.timerInterval);
    clearInterval(gameState.dischargeInterval);

    // 最終タイム計算
    const finalTime = (Date.now() - gameState.startTime) / 1000;
    elements.resultTime.textContent = finalTime.toFixed(2) + '秒';

    // 電池を満タン表示
    gameState.energy = 100;
    updateBatteryDisplay();

    // 結果画面表示
    setTimeout(() => {
        showScreen('result');
    }, 500);
}

// ゲームリセット
function resetGame() {
    // インターバル停止
    if (gameState.timerInterval) clearInterval(gameState.timerInterval);
    if (gameState.dischargeInterval) clearInterval(gameState.dischargeInterval);

    // 状態リセット
    gameState.energy = 0;
    gameState.isPlaying = false;
    gameState.startTime = null;
    gameState.lastClickTime = null;
    gameState.comboCount = 0;

    updateBatteryDisplay();
    elements.timer.textContent = 'タイム: 0.00秒';
    showScreen('start');
}

// イベントリスナー設定
elements.startBtn.addEventListener('click', startGame);
elements.replayBtn.addEventListener('click', resetGame);

// 充電ボタン（クリック＆タッチ対応）
elements.chargeBtn.addEventListener('click', charge);
elements.chargeBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    charge();
});

// キーボード対応（スペースキーで充電）
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && gameState.isPlaying) {
        e.preventDefault();
        charge();
    }
});

// 初期化
showScreen('start');
