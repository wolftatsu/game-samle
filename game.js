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
    playerName: '',
    finalTime: 0,
};

// DOM要素
const elements = {
    batteryPercentage: document.getElementById('batteryPercentage'),
    heartArea: document.getElementById('heartArea'),
    timer: document.getElementById('timer'),
    // 画面要素
    nameScreen: document.getElementById('nameScreen'),
    startScreen: document.getElementById('startScreen'),
    countdownScreen: document.getElementById('countdownScreen'),
    countdownNumber: document.getElementById('countdownNumber'),
    playScreen: document.getElementById('playScreen'),
    resultScreen: document.getElementById('resultScreen'),
    resultTime: document.getElementById('resultTime'),
    // ボタン要素
    playerNameInput: document.getElementById('playerNameInput'),
    nameSubmitBtn: document.getElementById('nameSubmitBtn'),
    playerNameDisplay: document.getElementById('playerNameDisplay'),
    playPlayerNameDisplay: document.getElementById('playPlayerNameDisplay'),
    resultPlayer: document.getElementById('resultPlayer'),
    rankingBody: document.getElementById('rankingBody'),
    startBtn: document.getElementById('startBtn'),
    chargeBtn: document.getElementById('chargeBtn'),
    replayBtn: document.getElementById('replayBtn'),
    gameContainer: document.querySelector('.game-container'),
    // 新デザイン用の要素
    moduleFills: [
        document.getElementById('module1'),
        document.getElementById('module2'),
        document.getElementById('module3'),
        document.getElementById('module4'),
        document.getElementById('module5'),
        document.getElementById('module6'),
        document.getElementById('module7'),
        document.getElementById('module8'),
    ],
    leds: [
        document.getElementById('led1'),
        document.getElementById('led2'),
        document.getElementById('led3'),
    ],
};

// 画面切り替え
function showScreen(screenName) {
    elements.nameScreen.classList.add('hidden');
    elements.startScreen.classList.add('hidden');
    elements.countdownScreen.classList.add('hidden');
    elements.playScreen.classList.add('hidden');
    elements.resultScreen.classList.add('hidden');

    switch (screenName) {
        case 'name':
            elements.nameScreen.classList.remove('hidden');
            break;
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

// ゲスト名生成
function generateGuestName() {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `ラブ_${randomNum}`;
}

// 名前送信処理
function submitName() {
    let name = elements.playerNameInput.value.trim();
    if (!name) {
        name = generateGuestName();
    }
    gameState.playerName = name;
    elements.playerNameDisplay.textContent = `プレイヤー: ${name}`;
    elements.playPlayerNameDisplay.textContent = `プレイヤー: ${name}`;
    startGame();
}

// ランキング取得
function getRanking() {
    const data = localStorage.getItem('batteryGameRanking');
    return data ? JSON.parse(data) : [];
}

// ランキング保存
function saveRanking(name, time) {
    let ranking = getRanking();
    ranking.push({ name, time, date: new Date().toISOString() });
    ranking.sort((a, b) => a.time - b.time);
    ranking = ranking.slice(0, 10);
    localStorage.setItem('batteryGameRanking', JSON.stringify(ranking));
    return ranking;
}

// ランキング表示
function displayRanking(ranking, currentTime) {
    const top5 = ranking.slice(0, 5);
    elements.rankingBody.innerHTML = '';

    top5.forEach((entry, index) => {
        const tr = document.createElement('tr');
        const isCurrentPlayer = entry.name === gameState.playerName && entry.time === currentTime;

        if (isCurrentPlayer) {
            tr.classList.add('current-player');
        }

        const rankClass = index < 3 ? `rank-${index + 1}` : '';

        tr.innerHTML = `
            <td class="${rankClass}">${index + 1}</td>
            <td>${entry.name}</td>
            <td>${entry.time.toFixed(2)}秒</td>
        `;
        elements.rankingBody.appendChild(tr);
    });
}

// 電池レベルの更新
function updateBatteryDisplay() {
    const percentage = Math.min(100, Math.max(0, gameState.energy));
    elements.batteryPercentage.textContent = Math.floor(percentage) + '%';

    // 色クラスの決定
    let colorClass = 'high';
    if (percentage < 30) {
        colorClass = 'low';
    } else if (percentage < 70) {
        colorClass = 'medium';
    }

    // 各モジュールの充填率を更新
    const numModules = elements.moduleFills.length;
    elements.moduleFills.forEach((fill, index) => {
        // 各モジュールが担当する範囲 (0-20, 20-40, 40-60, 60-80, 80-100)
        const rangeStart = (index / numModules) * 100;
        const rangeEnd = ((index + 1) / numModules) * 100;

        // 色クラスを更新
        fill.classList.remove('low', 'medium', 'high');
        fill.classList.add(colorClass);

        if (percentage >= rangeEnd) {
            fill.style.width = '100%';
        } else if (percentage > rangeStart) {
            const relativePercent = ((percentage - rangeStart) / (100 / numModules)) * 100;
            fill.style.width = `${relativePercent}%`;
        } else {
            fill.style.width = '0%';
        }
    });

    // LED状態の更新
    updateLEDs(percentage);
}

// LED状態の更新
function updateLEDs(percentage) {
    // 全LEDをリセット
    elements.leds.forEach(led => {
        led.classList.remove('active-green', 'active-orange', 'active-red');
    });

    if (percentage >= 100) {
        // 満タン: 全て緑
        elements.leds.forEach(led => led.classList.add('active-green'));
    } else if (percentage >= 70) {
        // 高充電: 2つ緑
        elements.leds[0].classList.add('active-green');
        elements.leds[1].classList.add('active-green');
    } else if (percentage >= 30) {
        // 中充電: 1つオレンジ
        elements.leds[0].classList.add('active-orange');
    } else if (percentage > 0) {
        // 低充電: 1つ赤（点滅）
        elements.leds[0].classList.add('active-red');
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
    gameState.finalTime = (Date.now() - gameState.startTime) / 1000;
    elements.resultTime.textContent = gameState.finalTime.toFixed(2) + '秒';
    elements.resultPlayer.textContent = gameState.playerName;

    // 電池を満タン表示
    gameState.energy = 100;
    updateBatteryDisplay();

    // ランキング保存・表示
    const ranking = saveRanking(gameState.playerName, gameState.finalTime);
    displayRanking(ranking, gameState.finalTime);

    // 結果画面表示
    setTimeout(() => {
        showScreen('result');
    }, 500);
}

// ゲームリセット（同じプレイヤーで再プレイ）
function resetGame() {
    // インターバル停止
    if (gameState.timerInterval) clearInterval(gameState.timerInterval);
    if (gameState.dischargeInterval) clearInterval(gameState.dischargeInterval);

    // 状態リセット（プレイヤー名は保持）
    gameState.energy = 0;
    gameState.isPlaying = false;
    gameState.startTime = null;
    gameState.lastClickTime = null;
    gameState.comboCount = 0;
    gameState.finalTime = 0;

    updateBatteryDisplay();
    elements.timer.textContent = 'タイム: 0.00秒';
    showScreen('start');
}

// 初期画面に戻る（名前入力から）
function goToNameScreen() {
    // インターバル停止
    if (gameState.timerInterval) clearInterval(gameState.timerInterval);
    if (gameState.dischargeInterval) clearInterval(gameState.dischargeInterval);

    // 完全リセット
    gameState.energy = 0;
    gameState.isPlaying = false;
    gameState.startTime = null;
    gameState.lastClickTime = null;
    gameState.comboCount = 0;
    gameState.finalTime = 0;
    gameState.playerName = '';

    elements.playerNameInput.value = '';
    updateBatteryDisplay();
    elements.timer.textContent = 'タイム: 0.00秒';
    showScreen('name');
}

// イベントリスナー設定
elements.nameSubmitBtn.addEventListener('click', submitName);
elements.playerNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        submitName();
    }
});
elements.startBtn.addEventListener('click', startGame);
elements.replayBtn.addEventListener('click', goToNameScreen);

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
showScreen('name');
