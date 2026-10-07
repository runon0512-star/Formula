// ====== 初期設定 ======
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// キャンバスサイズ
canvas.width = 1000;
canvas.height = 500; // キャンバスの高さを500

// === ズーム設定 ===
let ZOOM_LEVEL = 1.0; // スライダーで変更するため let に変更

// マシンサイズ (画に合わせて調整)
const CAR_WIDTH = 100;
const CAR_HEIGHT = 40;

// 道幅
let TRACK_WIDTH = 500; // グリッド配置に合わせて道幅を調整 (100px増加)
const SHOULDER_WIDTH = 50;
let NUM_AI_LANES = 12; // AIのレーン数
let KERB_WIDTH = 30; // 縁石の幅
let KERB_COLORS = ['#c00000', 'white'];
let KERB_GLOW_COLOR = null;
let KERB_GLOW_BLUR = 15;
let OFF_TRACK_COLOR = '#0a0';
let BACKGROUND_COLOR = '#000000';
let TRACK_COLOR = '#555555';
let IS_NIGHT_RACE = false;

// 壁のオフセット (コースの描画と当たり判定で使用)
const WALL_OFFSET = 0; // 透明な壁を撤去

// === 車の初期設定テンプレート ===
const carDefaults = {
    speed: 0,
    angle: -Math.PI/2, // 初期角度は0（右向き）
    maxSpeed: 16,
    maxSpeedReverse: 2,
    acceleration: 0.15,
    braking: 0.2,
    friction: 0.02,
    lateralFriction: 5,
    turnSpeed: 0.07, // 最大のステアリング感度を0.07に設定
    // AI固有のプロパティ (スタート遅延用)
    gameStartTime: 0,
    aiStartDelay: 0,
    aiHasStarted: false,
    driverName: "", // ドライバー名プロパティを追加
    // previousRank: 0 // 前フレームの順位を記録 (スタートグリッドからの変動に変更するため不要)
    startingGridRank: 0, // スタート時のグリッド順位を記録
    rating: 75, // AIレーティング (デフォルト値、AIカーはdriverLineupsから取得)
    hasFinished: false, // ゴールしたかどうか
    finishTime: 0,      // ゴールした時刻
    finalRank: 0,       // ゴール時の最終順位
    aggression: 0.5,    // AIの攻撃性 (0.0 - 1.0、0.5が標準)
    age: 25             // ドライバーの年齢 (デフォルト値)
};

// === プレイヤー選択情報 ===
let chosenPlayerInfo = {
    driverName: null,
    imageName: null,
    teamName: null, // Short name for player
    fullName: null, // Full name for player
    rating: null, // プレイヤーのレーティングも保持
    age: 18, // プレイヤーの初期年齢
    salary: 0 // プレイヤーの契約金を最初から0に設定
};
let chosenPlayer2Info = null;
let raceMode = 'single'; // 'single' or 'versus'
let versusSelectionPlayer = 1;
let cpuOpponentsEnabled = true;
let multiplayerPlayerCount = 2;
let multiplayerSelections = [];
let aiDrivingMode = 'real'; // 'real' (Hard) or 'easy'

// === DRS（旧「2位以下への定期速度補正」を置き換える唯一の追い抜き補助） ===
let drsEnabled = true;
const DRS_POINT_SPACING_PX = 5400; // 500m = 5,400px（20km/h/px・60fps換算）
const TIMING_POINT_SPACING_PX = DRS_POINT_SPACING_PX / 5; // 100mごとにタイム差を計測
const DRS_MAX_SPEED_BOOST = 1.06;
const DRS_MAX_GAP_SECONDS = 1.0;

// Add collision recovery rotation properties
carDefaults.isRotatingFromCollision = false;
carDefaults.collisionTargetAngle = null;
carDefaults.collisionRotationSpeed = 0.25; // 回転速度を増加 (例: 0.1 -> 0.25)
carDefaults.lateralVelocity = 0;
carDefaults.lastCarContactTime = 0;

// 最高速度超過時に適用する追加の減速値
const OVER_MAX_SPEED_DECELERATION = 0.05; // 通常の摩擦(0.02)より大きく、ブレーキ(0.2)より小さい値

// 後方の車ほど最高速度を増加させる係数
// 例: 0.01 の場合、1台後ろの車ごとにベースの最高速度の1%ずつ増加する
// 最後尾の車 (インデックス NUM_CARS - 1) は、 (NUM_CARS - 1) * 0.01 だけ割合が増加する
// (初期グリッド位置に基づく)
const MAX_SPEED_INCREASE_FACTOR_PER_CAR = 0;

// 現在の順位に応じて最高速度を調整する係数 (1位との差1ランクごとにこの割合で増加)
const CATCH_UP_SPEED_FACTOR_PER_RANK = 0; // 例: 1%ずつ増加 (0.005から変更)

// === スリップストリーム設定 ===
const SLIPSTREAM_DETECTION_DISTANCE_Y = CAR_HEIGHT * 10; // この距離以内(Y座標)で効果発動
const SLIPSTREAM_DETECTION_WIDTH_X = CAR_WIDTH * 0.5;   // この横ズレ以内(X座標)で効果発動
const SLIPSTREAM_BOOST_FACTOR = 1.08;                   // 最高速度の上昇係数 (1.08倍)
const SLIPSTREAM_MIN_SPEED_THRESHOLD = 10;              // この速度以上でなければ効果は発動しない
const SLIPSTREAM_DURATION = 100;                     // 効果の持続時間 (ms)
const SLIPSTREAM_DECAY_DURATION = 5000;                   // スリップストリーム効果が切れてから減速するまでの時間 (ms)


// === 車体画像のソース (提供されたファイル名を使用) ===
// ドライバーごとではなくチームごとの画像に変更
const carImageSources = [
    'RB_CAR.png',
    'MCL_CAR.png',
    'FER_CAR.png',
    'MER_CAR.png',
    'AM_CAR.png',
    'ALP_CAR.png',
    'WIL_CAR.png',
    'VC_CAR.png',
    'SAU_CAR.png',
    'HAA_CAR.png'
];

// === F1ドライバーラインナップ / マシン性能 ===
// 2025年FIA最終コンストラクターズ順位を基準に加速域を調整。
// 最高速はストレート特化ゲームで差が開きすぎないよう318～324km/hへ圧縮している。
// 各チームに対応する単一の画像ファイル名 image を追加し、images 配列を削除
// personality プロパティを追加
// contractYears プロパティを追加
let driverLineups = {
    "Red Bull":     { drivers: [{name: "VER", fullName: "Max Verstappen", rating: 99, aggression: 0.9, age: 27, salary: 0, personality: 'lone_wolf', contractYears: 1}, {name: "TSU", fullName: "Yuki Tsunoda", rating: 86, aggression: 0.7, age: 25, salary: 0, personality: 'aggressor', contractYears: 1}], image: "RB_CAR.png", tier: 1, accelerationFactor: 1.033, lowSpeedFactor: 1.025, midSpeedFactor: 1.035, highSpeedFactor: 1.040, maxSpeedFactor: 1.012, turnSpeedFactor: 1.03, funds: 1000000 },
    "McLaren":      { drivers: [{name: "NOR", fullName: "Lando Norris", rating: 93, aggression: 0.7, age: 25, salary: 0, personality: 'risk_averter', contractYears: 1}, {name: "PIA", fullName: "Oscar Piastri", rating: 93, aggression: 0.5, age: 24, salary: 0, personality: 'standard', contractYears: 1}], image: "MCL_CAR.png", tier: 1, accelerationFactor: 1.057, lowSpeedFactor: 1.060, midSpeedFactor: 1.065, highSpeedFactor: 1.045, maxSpeedFactor: 1.006, turnSpeedFactor: 1.05, funds: 1000000 },
    "Ferrari":      { drivers: [{name: "LEC", fullName: "Charles Leclerc", rating: 92, aggression: 0.65, age: 27, salary: 0, personality: 'standard', contractYears: 1}, {name: "HAM", fullName: "Lewis Hamilton", rating: 94, aggression: 0.75, age: 40, salary: 0, personality: 'aggressor', contractYears: 1}], image: "FER_CAR.png", tier: 2, accelerationFactor: 1.010, lowSpeedFactor: 1.005, midSpeedFactor: 1.010, highSpeedFactor: 1.015, maxSpeedFactor: 1.009, turnSpeedFactor: 1.02, funds: 1000000 },
    "Mercedes":     { drivers: [{name: "RUS", fullName: "George Russell", rating: 90, aggression: 0.6, age: 27, salary: 0, personality: 'center_keeper', contractYears: 1}, {name: "ANT", fullName: "Kimi Antonelli", rating: 80, aggression: 0.75, age: 18, salary: 0, personality: 'aggressor', contractYears: 1}], image: "MER_CAR.png", tier: 1, accelerationFactor: 1.017, lowSpeedFactor: 1.010, midSpeedFactor: 1.020, highSpeedFactor: 1.020, maxSpeedFactor: 1.004, turnSpeedFactor: 1.00, funds: 1000000 },
    "Aston Martin": { drivers: [{name: "ALO", fullName: "Fernando Alonso", rating: 90, aggression: 0.85, age: 43, salary: 0, personality: 'wall_hugger', contractYears: 1}, {name: "STR", fullName: "Lance Stroll", rating: 78, aggression: 0.4, age: 26, salary: 0, personality: 'standard', contractYears: 1}], image: "AM_CAR.png", tier: 3, accelerationFactor: 0.980, lowSpeedFactor: 0.975, midSpeedFactor: 0.980, highSpeedFactor: 0.985, maxSpeedFactor: 0.998, turnSpeedFactor: 0.99, funds: 1000000 },
    "Williams":     { drivers: [{name: "ALB", fullName: "Alexander Albon", rating: 88, aggression: 0.45, age: 29, salary: 0, personality: 'risk_averter', contractYears: 1}, {name: "SAI", fullName: "Carlos Sainz", rating: 91, aggression: 0.7, age: 30, salary: 0, personality: 'slipstream_hunter', contractYears: 1}], image: "WIL_CAR.png", tier: 2, accelerationFactor: 0.995, lowSpeedFactor: 0.990, midSpeedFactor: 0.990, highSpeedFactor: 1.005, maxSpeedFactor: 1.006, turnSpeedFactor: 0.97, funds: 1000000 },
    "Alpine":       { drivers: [{name: "GAS", fullName: "Pierre Gasly", rating: 85, aggression: 0.55, age: 29, salary: 0, personality: 'standard', contractYears: 1}, {name: "DOO", fullName: "Jack Doohan", rating: 77, aggression: 0.65, age: 22, salary: 0, personality: 'lone_wolf', contractYears: 1}], image: "ALP_CAR.png", tier: 5, accelerationFactor: 0.954, lowSpeedFactor: 0.945, midSpeedFactor: 0.950, highSpeedFactor: 0.968, maxSpeedFactor: 0.994, turnSpeedFactor: 0.98, funds: 1000000 },
    "VCARB":        { drivers: [{name: "LAW", fullName: "Liam Lawson", rating: 78, aggression: 0.95, age: 23, salary: 0, personality: 'aggressor', contractYears: 1}, {name: "HAD", fullName: "Isack Hadjar", rating: 78, aggression: 0.7, age: 20, salary: 0, personality: 'aggressor', contractYears: 1}], image: "VC_CAR.png", tier: 3, accelerationFactor: 0.983, lowSpeedFactor: 0.978, midSpeedFactor: 0.982, highSpeedFactor: 0.990, maxSpeedFactor: 1.000, turnSpeedFactor: 0.96, funds: 1000000 },
    "Kick Sauber":  { drivers: [{name: "HUL", fullName: "Nico Hulkenberg", rating: 84, aggression: 0.5, age: 37, salary: 0, personality: 'center_keeper', contractYears: 1}, {name: "BOR", fullName: "Gabriel Bortoleto", rating: 77, aggression: 0.65, age: 20, salary: 0, personality: 'risk_averter', contractYears: 1}], image: "SAU_CAR.png", tier: 4, accelerationFactor: 0.975, lowSpeedFactor: 0.965, midSpeedFactor: 0.972, highSpeedFactor: 0.988, maxSpeedFactor: 1.003, turnSpeedFactor: 0.95, funds: 1000000 },
    "Haas":         { drivers: [{name: "BEA", fullName: "Oliver Bearman", rating: 79, aggression: 0.7, age: 20, salary: 0, personality: 'lone_wolf', contractYears: 1}, {name: "OCO", fullName: "Esteban Ocon", rating: 84, aggression: 0.6, age: 28, salary: 0, personality: 'wall_hugger', contractYears: 1}], image: "HAA_CAR.png", tier: 4, accelerationFactor: 0.976, lowSpeedFactor: 0.968, midSpeedFactor: 0.975, highSpeedFactor: 0.985, maxSpeedFactor: 1.002, turnSpeedFactor: 0.93, funds: 1000000 }
};

// === F2/リザーブドライバープール (2025年想定) ===
// type: "F2", "Reserve"
// imageName: チーム画像を使用するため不要に
let reserveAndF2Drivers = [
    { name: "PER", fullName: "Sergio Perez", rating: 88, aggression: 0.6, age: 35, salary: 0, personality: 'slipstream_hunter', contractYears: 1 }, // Ex-F1 (Red Bullから移動)
    { name: "BOT", fullName: "Valtteri Bottas", rating: 86, aggression: 0.4, age: 35, salary: 0, personality: 'standard', contractYears: 1 }, // Ex-F1
    { name: "ZHO", fullName: "Guanyu Zhou", rating: 78, aggression: 0.35, age: 26, salary: 0, personality: 'risk_averter', contractYears: 1 }, // Ex-F1
    { name: "MAG", fullName: "Kevin Magnussen", rating: 79, aggression: 0.8, age: 32, salary: 0, personality: 'aggressor', contractYears: 1 }, // Ex-F1
    { name: "POU", fullName: "Theo Pourchaire", rating: 78, aggression: 0.6, age: 21, salary: 0, personality: 'standard', contractYears: 1 },
    { name: "DRU", fullName: "Felipe Drugovich", rating: 77, aggression: 0.5, age: 24, salary: 0, personality: 'center_keeper', contractYears: 1 },
    { name: "VMA", fullName: "Victor Martins", rating: 76, aggression: 0.55, age: 23, salary: 0, personality: 'standard', contractYears: 1 },
    { name: "IWA", fullName: "Ayumu Iwasa", rating: 75, aggression: 0.8, age: 23, salary: 0, personality: 'aggressor', contractYears: 1 },
    { name: "VES", fullName: "Frederik Vesti", rating: 77, aggression: 0.6, age: 23, salary: 0, personality: 'risk_averter', contractYears: 1 },
    { name: "HAU", fullName: "Dennis Hauger", rating: 74, aggression: 0.7, age: 22, salary: 0, personality: 'aggressor', contractYears: 1 },
    { name: "MAL", fullName: "Zane Maloney", rating: 73, aggression: 0.5, age: 21, salary: 0, personality: 'lone_wolf', contractYears: 1 },
    { name: "FIT", fullName: "Enzo Fittipaldi", rating: 72, aggression: 0.75, age: 23, salary: 0, personality: 'aggressor', contractYears: 1 },
    { name: "VCH", fullName: "Richard Verschoor", rating: 70, aggression: 0.4, age: 24, salary: 0, personality: 'standard', contractYears: 1 },
    { name: "MAI", fullName: "Kush Maini", rating: 71, aggression: 0.6, age: 24, salary: 0, personality: 'center_keeper', contractYears: 1 },
    { name: "CRA", fullName: "Jak Crawford", rating: 70, aggression: 0.5, age: 20, salary: 0, personality: 'standard', contractYears: 1 },
    { name: "ARO", fullName: "Paul Aron", rating: 69, aggression: 0.55, age: 21, salary: 0, personality: 'risk_averter', contractYears: 1 },
    { name: "COL", fullName: "Franco Colapinto", rating: 76, aggression: 0.8, age: 21, salary: 0, personality: 'aggressor', contractYears: 1 },
    { name: "PMA", fullName: "Pepe Martí", rating: 70, aggression: 0.6, age: 19, salary: 0, personality: 'standard', contractYears: 1 },
    { name: "SAR", fullName: "Logan Sargeant", rating: 74, aggression: 0.75, age: 24, salary: 0, personality: 'wall_hugger', contractYears: 1 }, // Ex-F1
    { name: "MSC", fullName: "Mick Schumacher", rating: 77, aggression: 0.5, age: 26, salary: 0, personality: 'center_keeper', contractYears: 1 },
    { name: "DEV", fullName: "Nyck de Vries", rating: 75, aggression: 0.6, age: 30, salary: 0, personality: 'standard', contractYears: 1 },
    { name: "ALC", fullName: "Arthur Leclerc", rating: 74, aggression: 0.65, age: 24, salary: 0, personality: 'aggressor', contractYears: 1 },
    { name: "BRO", fullName: "Luke Browning", rating: 76, aggression: 0.7, age: 23, salary: 0, personality: 'lone_wolf', contractYears: 1 },
    { name: "OSU", fullName: "Zak O'Sullivan", rating: 72, aggression: 0.6, age: 20, salary: 0, personality: 'risk_averter', contractYears: 1 },
    { name: "NOB", fullName: "Aurelia Nobels", rating: 62, aggression: 0.65, age: 18, salary: 0, personality: 'standard', contractYears: 1 }, // 既存
    { name: "PIN", fullName: "Doriane Pin", rating: 65, aggression: 0.65, age: 21, salary: 0, personality: 'standard', contractYears: 1 }, // 既存
    // === 追加ドライバー (10名) ===
    { name: "JUJ", fullName: "Juju Noda", rating: 51, aggression: 0.7, age: 19, salary: 0, personality: 'standard', contractYears: 1 },
    { name: "LIN", fullName: "Arvid Lindblad", rating: 73, aggression: 0.6, age: 18, salary: 0, personality: 'risk_averter', contractYears: 1 },
    { name: "MIN", fullName: "Gabriele Minì", rating: 74, aggression: 0.55, age: 20, salary: 0, personality: 'center_keeper', contractYears: 1 },
    { name: "BEG", fullName: "Dino Beganovic", rating: 72, aggression: 0.6, age: 21, salary: 0, personality: 'standard', contractYears: 1 },
    { name: "GOE", fullName: "Oliver Goethe", rating: 70, aggression: 0.5, age: 20, salary: 0, personality: 'lone_wolf', contractYears: 1 },
    { name: "TSO", fullName: "Nikola Tsolov", rating: 69, aggression: 0.75, age: 18, salary: 0, personality: 'aggressor', contractYears: 1 },
    { name: "FLO", fullName: "Sophia Flörsch", rating: 67, aggression: 0.5, age: 24, salary: 0, personality: 'wall_hugger', contractYears: 1 },
    { name: "MAN", fullName: "Christian Mansell", rating: 71, aggression: 0.6, age: 20, salary: 0, personality: 'standard', contractYears: 1 },
    { name: "SZT", fullName: "Kacper Sztuka", rating: 70, aggression: 0.65, age: 19, salary: 0, personality: 'risk_averter', contractYears: 1 }
];
// === 新規生成ドライバー用データ ===
const NATIONALITY_NAMES = {
    "USA": {
        first: ["James", "John", "Robert", "Michael", "William", "David", "Richard", "Joseph", "Thomas", "Charles", "Christopher", "Daniel", "Matthew", "Anthony", "Mark", "Donald", "Steven", "Paul", "Andrew", "Joshua", "Kevin", "Brian", "George", "Edward", "Ronald", "Timothy", "Jason", "Jeffrey", "Ryan", "Jacob", "Gary", "Nicholas", "Eric", "Jonathan", "Stephen", "Larry", "Justin", "Scott", "Brandon", "Benjamin", "Samuel", "Gregory", "Frank", "Alexander", "Raymond", "Patrick", "Dennis", "Jerry", "Tyler", "Aaron"],
        last: ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts"]
    },
    "Italy": {
        first: ["Giuseppe", "Giovanni", "Antonio", "Mario", "Luigi", "Francesco", "Angelo", "Vincenzo", "Pietro", "Salvatore", "Carlo", "Franco", "Domenico", "Bruno", "Paolo", "Michele", "Giorgio", "Aldo", "Sergio", "Luciano", "Roberto", "Andrea", "Marco", "Luca", "Alessandro", "Massimo", "Stefano", "Riccardo", "Davide", "Matteo", "Simone", "Fabio", "Lorenzo", "Claudio", "Walter", "Alberto", "Gabriele", "Enrico", "Federico", "Armando", "Gianni", "Renato", "Maurizio", "Tiziano", "Valerio", "Patrizio", "Emanuele", "Alessio", "Daniele", "Flavio"],
        last: ["Rossi", "Russo", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci", "Marino", "Greco", "Bruno", "Gallo", "Conti", "De Luca", "Mancini", "Costa", "Giordano", "Rizzo", "Lombardi", "Moretti", "Barbieri", "Fontana", "Santoro", "Mariani", "Rinaldi", "Caruso", "Ferrara", "Galli", "Martino", "Leone", "Longo", "Gentile", "Martinelli", "Vitale", "Marchetti", "De Angelis", "De Santis", "D'Amico", "Coppola", "Amato", "Palmieri", "Fabbri", "Serra", "Farina", "Bernardi", "Conte", "Villa", "Parisi", "Basile", "Ferri"]
    },
    "UK": {
        first: ["David", "John", "Paul", "Mark", "James", "Andrew", "Scott", "Steven", "Robert", "Stephen", "William", "Craig", "Michael", "Stuart", "Christopher", "Alan", "Colin", "Brian", "Kevin", "Peter", "Gary", "Neil", "Ian", "Richard", "Keith", "Graham", "Martin", "Lee", "Philip", "Darren", "Simon", "Jonathan", "Matthew", "Daniel", "Thomas", "Oliver", "Jack", "Harry", "George", "Charlie", "Edward", "Joseph", "Samuel", "Adam", "Ben", "Luke", "Alex", "Ryan", "Dylan", "Connor"],
        last: ["Smith", "Jones", "Williams", "Brown", "Taylor", "Davies", "Wilson", "Evans", "Thomas", "Roberts", "Johnson", "Lewis", "Walker", "Robinson", "Wood", "Thompson", "White", "Watson", "Jackson", "Wright", "Green", "Harris", "Cooper", "King", "Lee", "Martin", "Clarke", "James", "Morgan", "Hughes", "Edwards", "Moore", "Clark", "Harrison", "Scott", "Young", "Morris", "Hall", "Ward", "Turner", "Baker", "Hill", "Phillips", "Mitchell", "Patel", "Carter", "Bailey", "Parker", "Murray", "Collins"]
    },
    "Germany": {
        first: ["Michael", "Andreas", "Thomas", "Stefan", "Christian", "Matthias", "Martin", "Frank", "Peter", "Uwe", "Jürgen", "Wolfgang", "Klaus", "Manfred", "Bernd", "Werner", "Günter", "Heinz", "Gerhard", "Hans", "Dieter", "Horst", "Jörg", "Ralf", "Dirk", "Daniel", "Markus", "Torsten", "Sven", "Oliver", "Jan", "Alexander", "Sebastian", "Mario", "Patrick", "Holger", "Jens", "Lars", "Carsten", "Marco", "Benjamin", "Tobias", "Philipp", "Florian", "Dennis", "Kevin", "Marcel", "Pascal", "Nico", "Leon"],
        last: ["Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Schulz", "Hoffmann", "Schäfer", "Koch", "Bauer", "Richter", "Klein", "Wolf", "Schröder", "Neumann", "Schwarz", "Zimmermann", "Braun", "Krüger", "Hartmann", "Lange", "Werner", "Krause", "Lehmann", "Schmid", "Schulze", "Maier", "Köhler", "Herrmann", "König", "Walter", "Mayer", "Huber", "Kaiser", "Fuchs", "Peters", "Lang", "Scholz", "Möller", "Weiß", "Hahn", "Schubert", "Vogel", "Friedrich", "Keller", "Günther", "Frank"]
    },
    "France": {
        first: ["Jean", "Michel", "Philippe", "Alain", "Patrick", "Pierre", "Nicolas", "Christophe", "Christian", "Daniel", "Bernard", "Eric", "Frédéric", "Laurent", "Stéphane", "Vincent", "Bruno", "François", "David", "Olivier", "Thierry", "Pascal", "Hervé", "Marc", "Luc", "Didier", "Gilles", "Jacques", "André", "Claude", "Julien", "Sébastien", "Guillaume", "Romain", "Thomas", "Antoine", "Alexandre", "Mathieu", "Benoit", "Jerome", "Fabien", "Sylvain", "Loic", "Arnaud", "Cedric", "Yannick", "Gregory", "Florian", "Kevin", "Anthony"],
        last: ["Martin", "Bernard", "Thomas", "Petit", "Robert", "Richard", "Durand", "Dubois", "Moreau", "Laurent", "Simon", "Michel", "Lefebvre", "Leroy", "Roux", "David", "Bertrand", "Morel", "Fournier", "Girard", "Lambert", "Bonnet", "Francois", "Martinez", "Legrand", "Garnier", "Faure", "Rousseau", "Vincent", "Muller", "Henry", "Gauthier", "Roger", "Noel", "Meyer", "Lucas", "Meunier", "Jean", "Perrin", "Andre", "Clement", "Morin", "Aubert", "Lemaire", "Roy", "Chevalier", "Mercier", "Bourgeois", "Blanc", "Guerin"]
    },
    "Spain": {
        first: ["Antonio", "Jose", "Manuel", "Francisco", "David", "Juan", "Javier", "Daniel", "Carlos", "Jesus", "Miguel", "Rafael", "Pedro", "Angel", "Alejandro", "Fernando", "Luis", "Sergio", "Pablo", "Jorge", "Alberto", "Ramon", "Enrique", "Vicente", "Diego", "Ruben", "Ivan", "Oscar", "Andres", "Joaquin", "Santiago", "Victor", "Eduardo", "Mario", "Roberto", "Jaime", "Marcos", "Hector", "Adrian", "Raul", "Cesar", "Felix", "Guillermo", "Ricardo", "Gabriel", "Hugo", "Alvaro", "Ignacio", "Julio", "German"],
        last: ["Garcia", "Rodriguez", "Gonzalez", "Fernandez", "Lopez", "Martinez", "Sanchez", "Perez", "Gomez", "Martin", "Jimenez", "Ruiz", "Hernandez", "Diaz", "Moreno", "Munoz", "Alvarez", "Romero", "Alonso", "Gutierrez", "Navarro", "Torres", "Dominguez", "Vazquez", "Ramos", "Gil", "Serrano", "Blanco", "Molina", "Morales", "Suarez", "Ortega", "Delgado", "Castro", "Ortiz", "Rubio", "Marin", "Sanz", "Nunez", "Iglesias", "Medina", "Garrido", "Cortes", "Castillo", "Santos", "Lozano", "Guerrero", "Cano", "Prieto", "Mendez"]
    },
    "Brazil": {
        first: ["Jose", "Antonio", "Joao", "Francisco", "Carlos", "Paulo", "Pedro", "Lucas", "Luiz", "Marcos", "Gabriel", "Rafael", "Daniel", "Marcelo", "Bruno", "Eduardo", "Felipe", "Anderson", "Ricardo", "Rodrigo", "Roberto", "Marcio", "Edson", "Andre", "Fernando", "Fabio", "Leandro", "Thiago", "Guilherme", "Diego", "Vinicius", "Renato", "Alexandre", "Gustavo", "Leonardo", "Douglas", "Julio", "Cesar", "Vitor", "Flavio", "Wagner", "Sergio", "Rogerio", "Cristiano", "Clayton", "Cleber", "Cassio", "Caio", "Igor", "Henrique"],
        last: ["Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira", "Lima", "Gomes", "Costa", "Ribeiro", "Martins", "Carvalho", "Almeida", "Lopes", "Dias", "Barros", "Mendes", "Fernandes", "Barbosa", "Pinto", "Rocha", "Vieira", "Araujo", "Correia", "Moreira", "Nunes", "Marques", "Machado", "Freitas", "Cardoso", "Teixeira", "Castro", "Ramos", "Tavares", "Melo", "Rezende", "Moraes", "Duarte", "Azevedo", "Andrade", "Brito", "Campos", "Guimaraes", "Monteiro", "Nogueira", "Pires", "Siqueira", "Vasconcelos"]
    },
    "Netherlands": {
        first: ["Jan", "Pieter", "Johannes", "Hendrik", "Cornelis", "Willem", "Gerrit", "Jacobus", "Petrus", "Adrianus", "Martinus", "Gerardus", "Theodorus", "Antonius", "Franciscus", "Daan", "Bram", "Sem", "Lucas", "Milan", "Luuk", "Thijs", "Jesse", "Finn", "Levi", "Noah", "Lars", "Stijn", "Gijs", "Mees", "Ruben", "Thomas", "Tim", "Julian", "Max", "Teun", "Tijn", "Siem", "Niek", "Sam", "Joris", "Wouter", "Sander", "Bas", "Rick", "Niels", "Koen", "Mark", "Erik", "Dennis"],
        last: ["de Jong", "Jansen", "de Vries", "van den Berg", "van Dijk", "Bakker", "Visser", "Smit", "Meijer", "de Boer", "Mulder", "de Groot", "Bos", "Vos", "Peters", "Hendriks", "van Leeuwen", "Dekker", "Brouwer", "de Wit", "van der Meer", "van der Linden", "Jacobs", "Schouten", "van der Heijden", "van den Heuvel", "Willems", "van Vliet", "Hoekstra", "Maas", "Verhoeven", "Koster", "van den Brink", "van der Wal", "de Graaf", "van Dam", "van der Laan", "Blom", "Gerritsen", "Jonker", "Postma", "Kuipers", "de Ruiter", "van der Velden", "van den Broek", "Hermans", "van Wijk", "de Lange", "Timmer", "Groen"]
    }
};
const NUM_NEW_DRIVERS_PER_SEASON = 4; // 各シーズンで生成する新規ドライバーの数
// 追加のF2/リザーブドライバーは上記に統合または削除

// carImageSources に含まれるべき正しいファイル名リスト (driverLineups と同期確認用)
const expectedImageFilesFromLineups = [];
for (const team in driverLineups) {
    const teamImage = driverLineups[team].image;
    if (teamImage && !expectedImageFilesFromLineups.includes(teamImage)) {
        expectedImageFilesFromLineups.push(teamImage);
    }
}
if (JSON.stringify(carImageSources.slice().sort()) !== JSON.stringify(expectedImageFilesFromLineups.slice().sort())) {
    console.warn("Warning: carImageSources array might not perfectly match all image filenames defined in driverLineups. Ensure all images in driverLineups are also listed in carImageSources if they are meant to be loaded.");
}


const NUM_UNIQUE_CARS = carImageSources.length; // ロード対象の画像総数

// === スターティンググリッド設定 ===
// NUM_REGULAR_CARS と NUM_MCLAREN_CARS の定義は、現在のドライバー割り当てロジックでは
// 直接使用されていないため、NUM_CARS を直接定義します。
const NUM_CARS = 20; // ゲームに参加する総ドライバー数 (driverLineups に基づく)

const GRID_ROWS = Math.ceil(NUM_CARS / 2); // 10行 (20台 / 2列)
const GRID_COLS = 2; // 2列
const ROW_SPACING = CAR_HEIGHT + 100; // 縦方向の間隔
const COL_SPACING = CAR_WIDTH + 80; // 横方向の間隔

// cars配列を初期化
let cars = [];
const trackCenterX = canvas.width / 2;
const TIRE_MARK_MIN_DISTANCE = 8;
const TIRE_MARK_MAX_SEGMENTS_PER_CAR = 1200;

// 全ての画像がロードされたかを確認するためのカウンター
let loadedImagesCount = 0;
const imagesToLoad = carImageSources.length; // carImageSources 配列内の全画像

// === ゲーム進行フラグ ===
let allImagesLoaded = false;
// === ゲーム状態とシグナル ===
let gameState = 'loading'; // 'loading', 'title_screen', 'driver_selection', 'career_name_entry', 'career_team_selection', 'career_machine_performance', 'career_roster', 'signal_sequence', 'race', 'finished', 'all_finished', 'replay', 'career_season_end', 'career_team_standings', 'career_team_offers'
const SIGNAL_NUM_LIGHTS = 5;
const SIGNAL_LIGHT_ON_INTERVAL = 1000; // ms 各赤ランプの点灯から次のランプ点灯までの間隔
let SIGNAL_ALL_LIGHTS_ON_DURATION = 3000; // DEBUG: 全赤点灯時間を3秒に固定

let signalLightsOnCount = 0; // 点灯しているシグナルライトの数
let lastSignalChangeTimestamp = 0;
let raceActualStartTime = 0; // レースが実際に開始した時刻を記録
let zoomLevelBeforeSignal = ZOOM_LEVEL; // シグナルシーケンス開始前のズームレベルを保存 (初期化は gameState 移行時に行う)

// === シグナルシーケンス用カメラ設定 ===
let signalCameraPhase = 'idle'; // 'idle', 'show_full_grid', 'zoom_to_player', 'locked_on_player'
// let signalCameraCurrentTargetIndex = 0; // 以前のスクロール用、新しいロジックでは直接使用頻度は低い
let signalCameraScrollStartTime = 0;    // 現在のカメラフェーズが開始した時刻
let initialSignalZoom = 1.0; // グリッド全体表示時の計算されたズームレベル
const SIGNAL_CAMERA_GRID_VIEW_DURATION = 2000; // グリッド全体を静止して見る時間 (ms)
// SIGNAL_CAMERA_ZOOM_TO_PLAYER_DURATION はシグナル全体の残り時間から動的に計算


// === レースタイプとゴールライン設定 ===
const SEASON_SCHEDULE = [
    { name: "Bahrain GP", distance: -100000, trackWidth: 550, lanes: 13, kerbWidth: 30, kerbColors: ['#c00000', 'white'], kerbGlowColor: '#ffcc00', kerbGlowBlur: 60, offTrackColor: '#4a5214ff', backgroundColor: '#111111', trackColor: '#444444', isNight: true, points: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] },
    { name: "Japanese GP", distance: -110000, trackWidth: 500, lanes: 12, kerbWidth: 30, kerbColors: ['#c00000', 'white'], offTrackColor: '#006600', backgroundColor: '#003300', trackColor: '#555555', isNight: false, points: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] },
    { name: "Monaco GP", distance: -80000, trackWidth: 370, lanes: 10, kerbWidth: 20, kerbColors: ['#c00000', 'white'], offTrackColor: '#888888', backgroundColor: '#555555', trackColor: '#4a4a4a', isNight: false, points: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] },
    { name: "Miami GP", distance: -100000, trackWidth: 500, lanes: 12, kerbWidth: 30, kerbColors: ['#ff0000ff', 'white'], offTrackColor: '#00aaff', backgroundColor: '#c2c2c2ff', trackColor: '#666666', isNight: false, points: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] },
    { name: "Italian GP", distance: -100000, trackWidth: 520, lanes: 12, kerbWidth: 40, kerbColors: ['#c00000', 'white', '#009000', 'white'], offTrackColor: '#004400', backgroundColor: '#002200', trackColor: '#606060', isNight: false, points: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] },
    { name: "Belgian GP", distance: -120000, trackWidth: 600, lanes: 14, kerbWidth: 35, kerbColors: ['#ffcc00', '#c00000'], offTrackColor: '#003300', backgroundColor: '#001100', trackColor: '#505050', isNight: false, points: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] },
    { name: "Abu Dhabi GP", distance: -100000, trackWidth: 580, lanes: 14, kerbWidth: 30, kerbColors: ['#f22828ff', 'white'], kerbGlowColor: '#ffffffff', kerbGlowBlur: 60, offTrackColor: '#175f8cff', backgroundColor: '#454545ff', trackColor: '#161616ff', isNight: true, points: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] }
];
let currentRaceType = SEASON_SCHEDULE[0]; // 初期値 (initializeRaceSettingsで設定)
let GOAL_LINE_Y_POSITION = SEASON_SCHEDULE[0].distance; // 初期値
let selectedQuickRaceCourseIndex = 0;
const QUICK_RACE_SETTINGS_KEY = 'formulaStraightQuickRaceSettings';

function loadQuickRaceSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(QUICK_RACE_SETTINGS_KEY) || '{}');
        if (typeof saved.drsEnabled === 'boolean') drsEnabled = saved.drsEnabled;
        if (typeof saved.cpuOpponentsEnabled === 'boolean') cpuOpponentsEnabled = saved.cpuOpponentsEnabled;
        if (saved.aiDrivingMode === 'real' || saved.aiDrivingMode === 'easy') aiDrivingMode = saved.aiDrivingMode;
        if (Number.isInteger(saved.multiplayerPlayerCount) && saved.multiplayerPlayerCount >= 2 && saved.multiplayerPlayerCount <= 4) {
            multiplayerPlayerCount = saved.multiplayerPlayerCount;
        }
        if (Number.isInteger(saved.courseIndex) && saved.courseIndex >= 0 && saved.courseIndex < SEASON_SCHEDULE.length) {
            selectedQuickRaceCourseIndex = saved.courseIndex;
        }
    } catch (error) {
        console.warn('Quick race settings could not be loaded.', error);
    }
}

function saveQuickRaceSettings() {
    try {
        localStorage.setItem(QUICK_RACE_SETTINGS_KEY, JSON.stringify({
            drsEnabled,
            cpuOpponentsEnabled,
            multiplayerPlayerCount,
            aiDrivingMode,
            courseIndex: selectedQuickRaceCourseIndex
        }));
    } catch (error) {
        console.warn('Quick race settings could not be saved.', error);
    }
}

function applyCourseSettings(course) {
    currentRaceType = { ...course, points: [] };
    GOAL_LINE_Y_POSITION = course.distance;
    TRACK_WIDTH = course.trackWidth;
    NUM_AI_LANES = course.lanes;
    KERB_WIDTH = course.kerbWidth;
    KERB_COLORS = course.kerbColors;
    KERB_GLOW_COLOR = course.kerbGlowColor || course.kerbColors[0];
    KERB_GLOW_BLUR = course.kerbGlowBlur || 15;
    OFF_TRACK_COLOR = course.offTrackColor;
    BACKGROUND_COLOR = course.backgroundColor || '#000000';
    TRACK_COLOR = course.trackColor;
    IS_NIGHT_RACE = course.isNight;
}

function initializeRaceSettings(raceNumberInSeason) {
    const trackIndex = (raceNumberInSeason - 1) % SEASON_SCHEDULE.length;
    currentRaceType = SEASON_SCHEDULE[trackIndex];
    GOAL_LINE_Y_POSITION = currentRaceType.distance;

    TRACK_WIDTH = currentRaceType.trackWidth;
    NUM_AI_LANES = currentRaceType.lanes;
    KERB_WIDTH = currentRaceType.kerbWidth;
    KERB_COLORS = currentRaceType.kerbColors;
    KERB_GLOW_COLOR = currentRaceType.kerbGlowColor || currentRaceType.kerbColors[0];
    KERB_GLOW_BLUR = currentRaceType.kerbGlowBlur || 15;
    OFF_TRACK_COLOR = currentRaceType.offTrackColor;
    BACKGROUND_COLOR = currentRaceType.backgroundColor || '#000000';
    TRACK_COLOR = currentRaceType.trackColor;
    IS_NIGHT_RACE = currentRaceType.isNight;
}
const GOAL_LINE_THICKNESS = 20; // ゴールラインの描画時の太さ

// === 距離計算用定数・変数 (速度表示との整合性のため) ===
const SPEED_TO_KMH_FACTOR = 20; // playerCar.speed (px/frame) * 20 = km/h
const ASSUMED_FPS = 60;         // requestAnimationFrameのフレームレートを60FPSと仮定
const SECONDS_PER_HOUR = 3600;
let distanceToGoal = null;      // ゴールまでの残り距離 (km単位)
let carsFinishedCount = 0; // ゴールした車の数をカウント

// === リプレイ設定 ===
let raceHistory = []; // レース中の全車の状態を記録する配列
let replayFrameIndex = 0; // リプレイ再生中の現在のフレームインデックス
let selectedReplayCarIndex = 0; // リプレイで追尾する車のインデックス
let isReplayPaused = false; // リプレイ一時停止フラグ
let replaySpeedMultiplier = 1.0; // リプレイ再生速度 (例: 1.0で等速)
let lastReplayUpdateTime = 0; // リプレイ更新の最終時刻

let winnerFinishTime = 0; // 最初にゴールした車の時刻
// === UIボタンの定義 ===
const replayButton = {
    x: 0, y: 0, width: 150, height: 50, text: "Replay",
    isVisible: false,
    isClicked: function(mouseX, mouseY) {
        return this.isVisible && mouseX >= this.x && mouseX <= this.x + this.width && mouseY >= this.y && mouseY <= this.y + this.height;
    }
};
// === キャリアモード NEXTボタン ===
const careerNextButton = {
    x: 0, y: 0, width: 120, height: 40, text: "NEXT",
    isVisible: false,
    isClicked: function(mouseX, mouseY) {
        return this.isVisible && gameState === 'all_finished' && careerPlayerTeamName && // 表示条件を追加
               mouseX >= this.x && mouseX <= this.x + this.width && mouseY >= this.y && mouseY <= this.y + this.height;
    }
};

// === キャリアモード リプレイ終了後「結果に戻る」ボタン ===
const careerReplayBackButton = {
    x: 0, y: 0, width: 200, height: 50, text: "結果に戻る",
    isVisible: false,
    isClicked: function(mouseX, mouseY) {
        return this.isVisible && gameState === 'replay' && isReplayPaused && careerPlayerTeamName &&
               mouseX >= this.x && mouseX <= this.x + this.width && mouseY >= this.y && mouseY <= this.y + this.height;
    }
};

// === キャリアモード リプレイ終了後「もう一度リプレイを見る」ボタン ===
const careerReplayAgainButton = {
    x: 0, y: 0, width: 250, height: 50, text: "もう一度リプレイを見る",
    isVisible: false,
    isClicked: function(mouseX, mouseY) {
        return this.isVisible && gameState === 'replay' && isReplayPaused && careerPlayerTeamName &&
               mouseX >= this.x && mouseX <= this.x + this.width && mouseY >= this.y && mouseY <= this.y + this.height;
    }
};

// === クイックレースボタン ===
const quickRaceButton = {
    x: 0, y: 0, width: 200, height: 50, text: "クイックレース",
    isVisible: false, // drawTitleScreen で true に設定
    isClicked: function(mouseX, mouseY) {
        return this.isVisible && mouseX >= this.x && mouseX <= this.x + this.width && mouseY >= this.y && mouseY <= this.y + this.height;
    }
};

// === クイックレース用「戻る」ボタン ===
const quickRaceBackButton = {
    x: 0, y: 0, width: 120, height: 40, text: "Back",
    isVisible: false,
    isClicked: function(mouseX, mouseY) {
        return this.isVisible && gameState === 'all_finished' && careerPlayerTeamName === null && // クイックレースの終了時のみ
               mouseX >= this.x && mouseX <= this.x + this.width && mouseY >= this.y && mouseY <= this.y + this.height;
    }
};
// === キャリアモード用ボタンの定義 ===
const careerModeButton = {
    x: 0, y: 0, width: 200, height: 50, text: "キャリアモード",
    isVisible: false, // drawDriverSelectionScreen で true に設定
    isClicked: function(mouseX, mouseY) {
        return this.isVisible && mouseX >= this.x && mouseX <= this.x + this.width && mouseY >= this.y && mouseY <= this.y + this.height;
    }
};

// === セーブ/ロード関連 ===
const MAX_SAVE_SLOTS = 20;
const ALL_SAVES_KEY = 'formulaStraightAllSaves';
let saveSlotsMetadata = []; // セーブスロットのメタデータ（名前、タイムスタンプなど）を保持
let selectedSlotForAction = -1; // セーブ/ロード操作対象のスロットインデックス
let previousGameStateBeforeSaveLoad = null; // セーブ/ロード画面に入る前のgameStateを保持

const generalSaveButton = {
    x: 0, y: 0, width: 160, height: 40, text: "ゲームをセーブ",
    isVisible: false,
    isClicked: function(mouseX, mouseY) {
        return this.isVisible && mouseX >= this.x && mouseX <= this.x + this.width && mouseY >= this.y && mouseY <= this.y + this.height;
    }
};

const loadGameButton = { // タイトル画面用
    x: 0, y: 0, width: 200, height: 50, text: "キャリアをロード",
    isVisible: false,
    isClicked: function(mouseX, mouseY) {
        return this.isVisible && mouseX >= this.x && mouseX <= this.x + this.width && mouseY >= this.y && mouseY <= this.y + this.height;
    }
};

const backButton = { // セーブ・ロード画面用
    x: 10, y: 10, width: 100, height: 40, text: "戻る",
    isClicked: function(mouseX, mouseY) { // isVisible は各画面で制御
        return mouseX >= this.x && mouseX <= this.x + this.width && mouseY >= this.y && mouseY <= this.y + this.height;
    }
};

const deleteAllSavesButton = { // ロード画面用
    x: 0, y: 0, width: 220, height: 40, text: "すべてのセーブデータを削除",
    isVisible: false,
    isClicked: function(mouseX, mouseY) {
        return this.isVisible && mouseX >= this.x && mouseX <= this.x + this.width && mouseY >= this.y && mouseY <= this.y + this.height;
    }
};

// === セーブ/ロード画面レイアウト定数 ===
const SLOTS_PER_ROW = 5;
const SLOT_MARGIN_X = 20;
const SLOT_MARGIN_Y = 20;
const SLOT_START_Y_OFFSET = 120; // タイトルと戻るボタンの下
let calculatedSlotWidth = 0; // drawSaveLoadScreen で計算
let calculatedSlotHeight = 80; // 固定または動的に計算

// === キャリアモード マシンパフォーマンス画面 NEXTボタン ===
const careerMachinePerformanceNextButton = {
    x: 0, y: 0, width: 120, height: 40, text: "NEXT",
    isVisible: false,
    isClicked: function(mouseX, mouseY) {
        return this.isVisible && gameState === 'career_machine_performance' &&
               mouseX >= this.x && mouseX <= this.x + this.width && mouseY >= this.y && mouseY <= this.y + this.height;
    }
};

// === キャリアモード シーズン開始ボタン ===
const careerStartSeasonButton = {
    x: 0, y: 0, width: 220, height: 50, text: "NEXT", // テキストを "NEXT" に変更
    isVisible: false,
    isClicked: function(mouseX, mouseY) {
        return this.isVisible && gameState === 'career_roster' &&
               mouseX >= this.x && mouseX <= this.x + this.width && mouseY >= this.y && mouseY <= this.y + this.height;
    }
};
let careerPlayerName = { firstName: "", lastName: "" }; // キャリアモードのプレイヤー名 (姓と名)
let careerPlayerTeamName = null; // キャリアモードでプレイヤーが選択したチーム名
const careerModeAvailableTeams = ["Williams", "VCARB", "Haas"]; // キャリア初期に選択可能なチーム
// === キャリアモード シーズン設定 ===
const RACES_PER_SEASON = 7;
let currentSeasonNumber = 1;
let currentRaceInSeason = 1;
let careerDriverSeasonPoints = {}; // { "ドライバー名": ポイント, ... }
let careerTeamSeasonPoints = {}; // { "チーム名": ポイント, ... }
let previousRaceFinishingOrder = []; // 直前のレースの最終順位をドライバー名の配列で保存
// const racePointSystem = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]; // RACE_TYPESに移動
let playerLastSeasonRank = 0; // プレイヤーの前シーズンの最終順位
let offeredTeams = []; // オファーされたチームのリスト
let careerSeasonEndScrollY = 0; // ポイント表示画面のスクロールYオフセット
let previousSeasonPointsForDisplay = {}; // マシンパフォーマンス画面表示用の前シーズンポイント
let careerMachinePerformanceScrollY = 0; // マシンパフォーマンス画面のスクロールYオフセット
// === マシンアップグレード設定 ===
// === 資金獲得テーブル (順位別) ===
const fundsByRank = [
    700000, // 1st (500000から減額)
    600000, // 2nd (450000から減額)
    520000, // 3rd (400000から減額)
    440000, // 4th (350000から減額)
    380000, // 5th (300000から減額)
    320000, // 6th (250000から減額)
    260000, // 7th (200000から減額)
    220000, // 8th (180000から減額)
    190000,  // 9th (160000から減額)
    160000,  // 10th (140000から減額)
    150000,  // 11th (120000から減額)
    140000,  // 12th (100000から減額)
    130000,  // 13th (90000から減額)
    120000,  // 14th (80000から減額)
    110000,  // 15th (70000から減額)
    100000,  // 16th (60000から減額)
    90000,  // 17th (50000から減額)
    80000,  // 18th (40000から減額)
    70000,  // 19th (30000から減額)
    60000   // 20th (20000から減額)
];
let nextSeasonTiersForOfferDisplay = {}; // オファー表示用の来シーズンのTier情報を保持
let playerCareerHistory = []; // 各シーズンの成績などを記録する配列

// === タイトル画面用カメラ設定 ===
let titleScreenCameraOffsetY = 0;
const TITLE_SCREEN_SCROLL_SPEED = 0.5; // タイトル画面のコーススクロール速度

// === キャンバス内ズームスライダー設定 ===
const MIN_ZOOM = 0.5; // ズーム範囲の下限
const MAX_ZOOM = 1.0; // ズーム範囲の上限を1.0倍に変更
const SLIDER_TRACK_WIDTH = 15; // トラックの幅
const SLIDER_TRACK_HEIGHT = 150; // トラックの高さ
const SLIDER_THUMB_WIDTH = 25;  // つまみの幅
const SLIDER_THUMB_HEIGHT = 10; // つまみの高さ
const SLIDER_MARGIN_RIGHT = 30; // キャンバス右端からのマージン
let SLIDER_MARGIN_TOP = 20;   // 初期値。後に canvas.height を使って中央に配置

let sliderTrackX, sliderTrackY; // これらは draw 関数内で canvas サイズに基づいて計算
let isDraggingZoomSlider = false;

// 初期ZOOM_LEVELをスライダーのデフォルト値として設定
function calculateInitialZoomLevel() {
    // ZOOM_LEVEL は既に 1.0 で初期化されているので、ここでは特別な処理は不要
    // スライダーのYマージンをキャンバス中央になるように設定
    SLIDER_MARGIN_TOP = canvas.height / 2 - SLIDER_TRACK_HEIGHT / 2;
}
calculateInitialZoomLevel();

// === Scrollbar Settings ===
const SCROLLBAR_WIDTH = 12;
const SCROLLBAR_PADDING = 5; // スクロールバーとキャンバス右端との間のパディング
const SCROLLBAR_MIN_THUMB_HEIGHT = 20;
const SCROLLBAR_TRACK_COLOR = 'rgba(80, 80, 80, 0.7)';
const SCROLLBAR_THUMB_COLOR = 'rgba(130, 130, 130, 0.9)';
let isDraggingScrollbar = false;
let scrollbarDragStartMouseY = 0;
let scrollbarDragStartScrollY = 0;
let activeScrollbarScreen = null; // 'season_end', 'team_standings', 'machine_performance'
let scrollbarTrackHeightForDrag = 0;
let scrollbarThumbHeightForDrag = 0;
let scrollbarMaxScrollForDrag = 0;

// 初期ZOOM_LEVELをスライダーのデフォルト値として設定
function calculateInitialZoomLevel() {
    // ZOOM_LEVEL は既に 1.0 で初期化されているので、ここでは特別な処理は不要
    // スライダーのYマージンをキャンバス中央になるように設定
    SLIDER_MARGIN_TOP = canvas.height / 2 - SLIDER_TRACK_HEIGHT / 2;
}
calculateInitialZoomLevel();

// Moved from later in the file to ensure it's defined before use.
// This function loads metadata for save slots from localStorage.
function loadSaveSlotsMetadata() {
    const allSavesRaw = localStorage.getItem(ALL_SAVES_KEY);
    let allSaves = [];
    if (allSavesRaw) {
        try {
            allSaves = JSON.parse(allSavesRaw);
            if (!Array.isArray(allSaves)) allSaves = []; // 配列でなければリセット
        } catch (e) {
            console.error("Failed to parse save data from localStorage:", e);
            allSaves = [];
        }
    }

    saveSlotsMetadata = [];
    for (let i = 0; i < MAX_SAVE_SLOTS; i++) {
        if (allSaves[i] && typeof allSaves[i] === 'object' && allSaves[i] !== null) {
            saveSlotsMetadata.push({
                name: allSaves[i].saveName || `スロット ${i + 1}`,
                timestamp: allSaves[i].timestamp || 0,
                isEmpty: false,
                slotIndex: i
            });
        } else {
            saveSlotsMetadata.push({
                name: `空きスロット ${i + 1}`,
                timestamp: 0,
                isEmpty: true,
                slotIndex: i
            });
        }
    }
}

// === ドライバー契約金計算関数 ===
function calculateDriverSalary(rating) {
    let totalSalary = 0;

    if (rating >= 50) {
        const baseSalaryAt50 = 10000; // レート50の時の基本給与
        const salaryIncreasePerRatingPoint = 29800; // レート50を超えた場合の1ポイントあたりの給与増加額
                                                  // (1500000 - 10000) / (100 - 50) = 1490000 / 50 = 29800
        totalSalary = baseSalaryAt50 + (rating - 50) * salaryIncreasePerRatingPoint;
    } else {
        // レーティング50未満は契約金0
        totalSalary = 0;
    }

    return Math.floor(totalSalary / 10000) * 10000; // 10,000ドル単位に丸める
}

// === 新規ドライバー生成関数 ===
// generateUniqueShortName と 古い generateNewDriver をこの新しい関数で置き換える
function generateNewDriver() {
    // 全ての既存ドライバーの短縮名を集める
    const existingShortNames = [];
    for (const teamName in driverLineups) {
        driverLineups[teamName].drivers.forEach(d => existingShortNames.push(d.name));
    }
    reserveAndF2Drivers.forEach(d => existingShortNames.push(d.name));

    let newShortName;
    let newFirstName;
    let newLastName;
    let newFullName;
    let newNationality;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 200; // 試行回数を増やす

    while (!isUnique && attempts < maxAttempts) {
        // 1. 国籍と名前をランダムに選択
        const nationalities = Object.keys(NATIONALITY_NAMES);
        newNationality = nationalities[Math.floor(Math.random() * nationalities.length)];
        const nameData = NATIONALITY_NAMES[newNationality];
        newFirstName = nameData.first[Math.floor(Math.random() * nameData.first.length)];
        newLastName = nameData.last[Math.floor(Math.random() * nameData.last.length)];
        newFullName = `${newFirstName} ${newLastName}`;

        // 2. 短縮名の候補を生成し、重複をチェック
        let candidates = [];
        const cleanFirstName = newFirstName.replace(/\s/g, '');
        const cleanLastName = newLastName.replace(/\s/g, '');

        // 候補1 (優先): Lastの頭3文字
        if (cleanLastName.length >= 3) {
            candidates.push(cleanLastName.substring(0, 3).toUpperCase());
        }
        // 候補2: Firstの1文字目 + Lastの頭2文字
        if (cleanFirstName.length >= 1 && cleanLastName.length >= 2) {
            candidates.push((cleanFirstName.charAt(0) + cleanLastName.substring(0, 2)).toUpperCase());
        }
        // 候補3: Firstの頭2文字 + Lastの頭1文字
        if (cleanFirstName.length >= 2 && cleanLastName.length >= 1) {
            candidates.push((cleanFirstName.substring(0, 2) + cleanLastName.charAt(0)).toUpperCase());
        }

        // 重複しないユニークな候補を探す
        for (const candidate of candidates) {
            if (candidate.length === 3 && !existingShortNames.includes(candidate)) {
                newShortName = candidate;
                isUnique = true;
                break; // 候補が見つかったので for ループを抜ける
            }
        }
        if (isUnique) {
            continue; // while ループを抜ける
        }
        // 全ての候補がダメだったら、次の名前の組み合わせを試す
        attempts++;
    }

    // 4. フォールバック処理 (maxAttemptsに達した場合)
    if (!isUnique) {
        console.warn("Could not generate a unique short name after max attempts. Using random letters.");
        do {
            newShortName = String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
                           String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
                           String.fromCharCode(65 + Math.floor(Math.random() * 26));
        } while (existingShortNames.includes(newShortName));
        // この場合、フルネームと短縮名の関連性がなくなるが、ユニークさは保証される
    }

    // 5. ドライバーの他のステータスを生成
    const newRating = Math.floor(Math.random() * (85 - 50 + 1)) + 50; // 50から75の範囲
    const newAggression = parseFloat((Math.random() * (0.9 - 0.3) + 0.3).toFixed(2)); // 0.3から0.9の範囲
    const newAge = 18;
    const newSalary = calculateDriverSalary(newRating);
    const personalities = ['standard', 'center_keeper', 'risk_averter', 'aggressor', 'lone_wolf', 'wall_hugger', 'slipstream_hunter'];
    const newPersonality = personalities[Math.floor(Math.random() * personalities.length)];

    // 6. ドライバーオブジェクトを返す
    return {
        name: newShortName,
        fullName: newFullName,
        nationality: newNationality, // 国籍プロパティを追加
        rating: newRating,
        aggression: newAggression,
        age: newAge,
        salary: newSalary,
        personality: newPersonality,
        contractYears: 1
    };
}

// === 全ドライバーの契約金を初期化する関数 ===
function initializeDriverSalaries() {
    for (const teamName in driverLineups) {
        driverLineups[teamName].drivers.forEach(driver => {
            driver.salary = calculateDriverSalary(driver.rating);
            if (!driver.contractYears) driver.contractYears = 1;
            if (!driver.personality) driver.personality = 'standard'; // personality がない場合にデフォルトを設定
        });
    }
    reserveAndF2Drivers.forEach(driver => {
        driver.salary = calculateDriverSalary(driver.rating);
        if (!driver.contractYears) driver.contractYears = 1;
        if (!driver.personality) driver.personality = 'standard'; // personality がない場合にデフォルトを設定
    });
    console.log("Driver salaries initialized.");
}

// 画像ロード完了後にゲームを開始するヘルパー関数
function checkAllImagesLoadedAndStartGame() {
    if (loadedImagesCount === imagesToLoad && !allImagesLoaded) { // 複数回呼び出されるのを防ぐ
        allImagesLoaded = true;
        loadQuickRaceSettings();
        applyCourseSettings(SEASON_SCHEDULE[selectedQuickRaceCourseIndex]);
        initializeDriverSalaries(); // ドライバーの契約金を初期化
        loadSaveSlotsMetadata(); // セーブスロット情報をロード
        gameState = 'title_screen'; // タイトル画面から開始
        // initializeCars(); // ドライバー選択後に呼び出す
        // signalLightsOnCount = 0; // ドライバー選択後に設定
        // lastSignalChangeTimestamp = Date.now(); // ドライバー選択後に設定
        // SIGNAL_ALL_LIGHTS_ON_DURATION = Math.random() * 1000 + 500; // ドライバー選択後に設定
        gameLoop();
    }
}

// 画像を事前にロード
// const carImages = []; // この配列は直接使用されなくなります
const loadedCarImageObjects = {}; // ファイル名をキーとするImageオブジェクトのマップ
const REMOTE_IMAGE_FALLBACK_BASE = 'https://raw.githubusercontent.com/runon0512-star/Formula/refs/heads/main/';

// carImageSources にリストされた全ての画像をロード
carImageSources.forEach(src => {
    const img = new Image();
    let remoteFallbackAttempted = false;
    img.onload = () => {
        loadedImagesCount++;
        loadedCarImageObjects[src] = img; // ファイル名をキーとして保存
        checkAllImagesLoadedAndStartGame();
    };
    img.onerror = () => {
        if (!remoteFallbackAttempted) {
            remoteFallbackAttempted = true;
            const remoteUrl = `${REMOTE_IMAGE_FALLBACK_BASE}${encodeURIComponent(src)}`;
            console.warn(`Local image not found: ${src}. Trying remote fallback: ${remoteUrl}`);
            img.src = remoteUrl;
            return;
        }
        console.error(`Failed to load image locally and remotely: ${src}`);
        loadedImagesCount++;
        checkAllImagesLoadedAndStartGame(); // エラーでもカウンターは進め、他がロードされれば開始試行
    };
    img.src = src;
});

// グリッド配置の初期Y座標 (画面上部から少し離す)
const initialGridY = canvas.height * 0.15; // キャンバスが小さくなったので、割合を維持

// 配列をシャッフルするヘルパー関数 (Fisher-Yates shuffle)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

/**
 * Maps a value from one range to another.
 * @param {number} value The input value to map.
 * @param {number} inMin The lower bound of the input range.
 * @param {number} inMax The upper bound of the input range.
 * @param {number} outMin The lower bound of the output range.
 * @param {number} outMax The upper bound of the output range.
 * @returns {number} The mapped value.
 */
function mapRange(value, inMin, inMax, outMin, outMax) {
    // Clamp the value to the input range
    const clampedValue = Math.max(inMin, Math.min(inMax, value));
    // Calculate the proportion of the value within its range
    const proportion = (clampedValue - inMin) / (inMax - inMin);
    // Map the proportion to the output range
    return outMin + proportion * (outMax - outMin);
}
// gridCarTypeOrderIndices は新しいロジックでは使用しません。

const numAiCars = NUM_CARS - 1; // 19台のAIカー
// cars配列は initializeCars 関数内で初期化される
// let cars = []; // グローバルスコープでの初期化は initializeCars に移動

// ヘルパー関数: プレイヤーの表示名をフォーマット
function formatPlayerDisplayName(firstName, lastName) {
    if (!firstName || !lastName || firstName.trim() === "" || lastName.trim() === "") {
        return "PLAYER"; // フォールバック
    }
    const firstInitial = firstName.charAt(0).toUpperCase();
    const lastThree = lastName.substring(0, Math.min(3, lastName.length)).toUpperCase();
    return `${firstInitial}.${lastThree}`;
}
function initializeCars() {
    cars = []; // 関数呼び出し時にクリアして再構築

    // --- プレイヤー情報 (選択された情報を使用) ---
    if (!chosenPlayerInfo || !chosenPlayerInfo.driverName) {
        console.warn("Player driver not selected, defaulting to Piastri for initialization.");
        // フォールバックとしてデフォルトのドライバーを設定
        // キャリアモードで名前が入力されていればそれを使う
        if (careerPlayerName && careerPlayerName.firstName && careerPlayerName.lastName) {
            chosenPlayerInfo = {
                driverName: formatPlayerDisplayName(careerPlayerName.firstName, careerPlayerName.lastName), // フォーマット済み短縮名
                fullName: careerPlayerName.firstName + " " + careerPlayerName.lastName, // フルネーム
                // imageName, teamName, rating はチーム/ドライバー選択時に設定される
                age: chosenPlayerInfo.age, // キャリア開始時の年齢
                imageName: chosenPlayerInfo.imageName || (careerPlayerTeamName ? driverLineups[careerPlayerTeamName].image : driverLineups["VCARB"].image), // キャリアならチームの画像、なければ仮
                teamName: careerPlayerTeamName || chosenPlayerInfo.teamName || "VCARB", // teamNameはそのまま
                rating: chosenPlayerInfo.rating || (careerPlayerTeamName ? driverLineups[careerPlayerTeamName].drivers[1].rating : driverLineups["VCARB"].drivers[0].rating) // キャリアならセカンドドライバーのレーティング、なければ仮
            };
        } else {
            // chosenPlayerInfo.age は既にデフォルト値(18) or キャリア開始時の値が設定されている
            // 通常のドライバー選択の場合、chosenPlayerInfo はクリック時に設定されるので、
            // ここでのフォールバックは、直接 'signal_sequence' などで始まった場合の極端なケース用
            // chosenPlayerInfo.driverName が null のままなら、後続の playerCarIndex の設定で問題が起きる可能性がある
            // そのため、何らかのデフォルトを設定しておく
            if (!chosenPlayerInfo.driverName) {
                console.warn("chosenPlayerInfo.driverName is null, setting a hard default for safety.");
                // このフォールバックは、キャリアモード以外のフローで問題が発生した場合の最終手段
            }
            // キャリアモードでない場合、chosenPlayerInfo は通常、ドライバー選択クリック時に設定される
            const defaultTeamData = driverLineups["McLaren"];
            const defaultDriverIndex = 1; // O.PIA
            chosenPlayerInfo = {
                driverName: defaultTeamData.drivers[defaultDriverIndex].name, // AIの短縮名
                fullName: defaultTeamData.drivers[defaultDriverIndex].fullName, // AIのフルネーム
                imageName: defaultTeamData.image, // チームの画像
                teamName: "McLaren",
                rating: defaultTeamData.drivers[defaultDriverIndex].rating,
                age: defaultTeamData.drivers[defaultDriverIndex].age // AIの年齢
            };
        }
    }
    const selectedPlayerInfos = raceMode === 'versus'
        ? multiplayerSelections.slice(0, multiplayerPlayerCount).filter(Boolean)
        : [chosenPlayerInfo];
    const playerDriverInfo = selectedPlayerInfos[0] || chosenPlayerInfo;
    const player2DriverInfo = selectedPlayerInfos[1] || null;

    // currentDriverLineups は、このレースのために cars 配列を構築する際に使用する
    // driverLineups (グローバル) は、handleAiDriverTransfers によって更新された新シーズンの正しいロスターのはず
    // let currentDriverLineups = driverLineups; // グローバルな driverLineups を直接変更するため、このローカル変数は使用しない方針へ

    if (careerPlayerTeamName && playerDriverInfo.driverName) {
        // キャリアモードの場合、グローバルな driverLineups オブジェクトを直接更新してプレイヤー情報を反映させる。
        // これにより、レース後のポイント計算時に正しいチーム構成が参照される。
        // handleAiDriverTransfers はシーズン間の移籍を処理し、その際もグローバルな driverLineups を更新する。
        const teamForPlayer = driverLineups[careerPlayerTeamName]; // グローバルな driverLineups を直接参照・更新

        if (teamForPlayer) {
            const playerShortName = playerDriverInfo.driverName; // chosenPlayerInfo.driverName (フォーマット済み)
            let playerFoundInTeamRoster = false;

            for (let i = 0; i < teamForPlayer.drivers.length; i++) {
                if (teamForPlayer.drivers[i].name === playerShortName) {
                    // プレイヤーが既にチームのロスターにいる (handleAiDriverTransfersによる配置)
                    // chosenPlayerInfo の最新情報で更新
                    teamForPlayer.drivers[i] = {
                        name: playerShortName,
                        fullName: playerDriverInfo.fullName,
                        rating: playerDriverInfo.rating,
                        aggression: teamForPlayer.drivers[i].aggression !== undefined ? teamForPlayer.drivers[i].aggression : carDefaults.aggression,
                        age: playerDriverInfo.age
                    };
                    playerFoundInTeamRoster = true;
                    break;
                }
            }

            if (!playerFoundInTeamRoster) {
                // プレイヤーがチームのロスターにいなかった場合 (キャリア初期設定時など)
                // プレイヤーを配置する (通常はセカンドドライバーの位置)
                const newPlayerData = {
                    name: playerShortName,
                    fullName: playerDriverInfo.fullName,
                    rating: playerDriverInfo.rating,
                    aggression: (teamForPlayer.drivers.length > 1 && teamForPlayer.drivers[1] && teamForPlayer.drivers[1].aggression !== undefined) ? teamForPlayer.drivers[1].aggression : carDefaults.aggression,
                        age: playerDriverInfo.age,
                        contractYears: playerDriverInfo.contractYears || 1
                };

                if (teamForPlayer.drivers.length >= 2) {
                    console.log(`Player ${playerShortName} not found in ${careerPlayerTeamName} roster, replacing driver at index 1.`);
                    const replacedDriver = teamForPlayer.drivers[1]; // 置き換えられるドライバーを取得
                    teamForPlayer.drivers[1] = newPlayerData;
                    // 置き換えられたドライバーをリザーブプールに追加
                    if (replacedDriver && replacedDriver.name !== playerShortName) {
                        const existingReserve = reserveAndF2Drivers.find(d => d.name === replacedDriver.name);
                        if (!existingReserve) {
                            const teamTier = teamForPlayer.tier || 5; // contractYears を追加
                            reserveAndF2Drivers.push({ name: replacedDriver.name, fullName: replacedDriver.fullName || replacedDriver.name, rating: replacedDriver.rating, aggression: replacedDriver.aggression !== undefined ? replacedDriver.aggression : carDefaults.aggression, age: replacedDriver.age });
                            console.log(`Replaced driver ${replacedDriver.name} from ${careerPlayerTeamName} (Tier ${teamTier}) added to reserve/F2 pool.`);
                            reserveAndF2Drivers.sort((a, b) => b.rating - a.rating); // レーティングでソート
                        }
                    }
                } else if (teamForPlayer.drivers.length === 1) {
                    console.log(`Player ${playerShortName} not found in ${careerPlayerTeamName} roster (1 driver team), replacing driver at index 0.`);
                    const replacedDriver = teamForPlayer.drivers[0]; // 置き換えられるドライバーを取得
                    teamForPlayer.drivers[0] = newPlayerData;
                    // 置き換えられたドライバーをリザーブプールに追加 (上記と同様のロジック)
                    if (replacedDriver && replacedDriver.name !== playerShortName) {
                        // (重複を避けるため、上記と全く同じコードブロックをここに挿入)
                    }
                } else {
                    console.log(`Player ${playerShortName} not found in ${careerPlayerTeamName} roster (0 driver team), adding player.`);
                    teamForPlayer.drivers.push(newPlayerData);
                }
            }
        } else {
            console.error(`Career mode: Player's team ${careerPlayerTeamName} not found in driverLineups for player placement.`);
        }
    }

    // --- 全ドライバーのプールを作成 (プレイヤーを含む) ---
    let allDriverPool = [];
    for (const teamName in driverLineups) { // 上記で更新された可能性のあるグローバルな driverLineups を使用
        const team = driverLineups[teamName];
        team.drivers.forEach((driverObj) => { // driverObj is {name, rating}
            // プレイヤーも含めて全ドライバーをプールに追加
            allDriverPool.push({
                driverName: driverObj.name,
                fullName: driverObj.fullName || driverObj.name, // playerTeam.drivers に fullName がない場合を考慮
                rating: driverObj.rating,
                aggression: driverObj.aggression !== undefined ? driverObj.aggression : carDefaults.aggression, // aggressionも追加
                age: driverObj.age, // 年齢も追加
                personality: driverObj.personality || 'standard', // personalityも追加
                contractYears: driverObj.contractYears || 1, // contractYearsも追加
                isInSlipstream: false, // スリップストリーム状態
                slipstreamEndTime: 0,  // スリップストリーム終了時刻
                slipstreamDecayStartTime: 0, // スリップストリーム効果の減衰開始時刻
                teamName: teamName
            });
        });
    }

    // チームのティアには依存せず、全ドライバーを同条件でグリッドへ並べる。
    let orderedDriversForGrid = [...allDriverPool];
    shuffleArray(orderedDriversForGrid);

    // MultiplayerでCPUをOFFにした場合は、選択したプレイヤー車だけを出走させる。
    const cpuFreeVersus = raceMode === 'versus' && !cpuOpponentsEnabled;
    if (cpuFreeVersus) {
        const playerNames = new Set(selectedPlayerInfos.map(player => player.driverName));
        orderedDriversForGrid = orderedDriversForGrid.filter(driver => playerNames.has(driver.driverName));
    }
    const expectedCarCount = cpuFreeVersus ? multiplayerPlayerCount : NUM_CARS;

    // ヘルパー関数: 車をグリッドに配置 (isPlayer引数を削除し、内部で判定)
    const addCarToGrid = (driverInfo, gridPos) => { // gridPos は 0 から始まるインデックス
        const car = { ...carDefaults };
        car.driverName = driverInfo.driverName;
        car.fullName = driverInfo.fullName;
        car.image = loadedCarImageObjects[driverLineups[driverInfo.teamName].image]; // 更新されたグローバルな driverLineups から画像取得
        car.aggression = driverInfo.aggression !== undefined ? driverInfo.aggression : carDefaults.aggression;
        car.rating = driverInfo.rating !== undefined ? driverInfo.rating : carDefaults.rating;
        car.age = driverInfo.age !== undefined ? driverInfo.age : carDefaults.age;
        car.personality = driverInfo.personality || 'standard'; // personalityをcarオブジェクトに設定
        car.isInSlipstream = false;
        car.slipstreamEndTime = 0;
        car.lastDrsPointIndex = 0;
        car.timingCheckpointTimes = {};
        car.lastTimingCheckpointIndex = 0;
        car.isDrsActive = false;
        car.drsActiveUntilY = null;
        car.teamName = driverInfo.teamName;
        car.tireMarks = [];
        car.lastTireMarkWheels = null;
        const isPlayer = selectedPlayerInfos.some(player => player.driverName === driverInfo.driverName);

        const teamData = driverLineups[driverInfo.teamName]; // 更新されたグローバルな driverLineups を使用
        const teamMaxSpeedFactor = amplifyPerformanceFactor(teamData.maxSpeedFactor || 1.0);
        const teamTurnSpeedFactor = teamData.turnSpeedFactor || 1.0;

        car.acceleration = carDefaults.acceleration;
        car.lowSpeedFactor = amplifyPerformanceFactor(teamData.lowSpeedFactor || teamData.accelerationFactor || 1.0);
        car.midSpeedFactor = amplifyPerformanceFactor(teamData.midSpeedFactor || teamData.accelerationFactor || 1.0);
        car.highSpeedFactor = amplifyPerformanceFactor(teamData.highSpeedFactor || teamData.accelerationFactor || 1.0);
        car.turnSpeed = carDefaults.turnSpeed * teamTurnSpeedFactor;
        const teamAdjustedBaseMaxSpeed = carDefaults.maxSpeed * teamMaxSpeedFactor;

        if (isPlayer) {
            car.aiStartDelay = 0;
            car.aiHasStarted = true;
        } else {
            car.aiStartDelay = 0;
            car.aiHasStarted = false;
        }

        const gridCol = gridPos % GRID_COLS;
        const gridRow = Math.floor(gridPos / GRID_COLS);

        if (gridCol === 0) {
            car.x = trackCenterX - (COL_SPACING / 2) - CAR_WIDTH;
            car.y = initialGridY + gridRow * ROW_SPACING - (ROW_SPACING * 0.5);
        } else {
            car.x = trackCenterX + (COL_SPACING / 2);
            car.y = initialGridY + gridRow * ROW_SPACING;
        }

        car.gridAdjustedMaxSpeed = teamAdjustedBaseMaxSpeed * (1 + gridPos * MAX_SPEED_INCREASE_FACTOR_PER_CAR);
        car.maxSpeed = car.gridAdjustedMaxSpeed;
        car.startingGridRank = gridPos + 1;

        cars.push(car);
    };

    // 決定された順序 (orderedDriversForGrid) に従って車をグリッドに配置
    orderedDriversForGrid.forEach((driverInfo, index) => {
        if (cars.length < expectedCarCount) {
            addCarToGrid(driverInfo, index); // index がそのまま gridPos になる
        }
    });

    // プレイヤーを最後尾に固定するロジックは削除

    // 最終確認
    if (cars.length !== expectedCarCount) {
        console.error(`Grid assignment error: Expected ${expectedCarCount} cars, but got ${cars.length}.`);
        console.log(`Player: ${playerDriverInfo.driverName}`);
    }

    // グローバルな playerCarIndex を設定
    playerCarIndex = cars.findIndex(car => car.driverName === playerDriverInfo.driverName);
    if (playerCarIndex === -1) {
        console.error("Player car could not be found in the 'cars' array after initialization. Defaulting to index 0.");
        playerCarIndex = 0; // フォールバック
    }
    playerCarIndices = selectedPlayerInfos.map(player => cars.findIndex(car => car.driverName === player.driverName));
    playerCarIndex = playerCarIndices[0] ?? playerCarIndex;
    secondPlayerCarIndex = playerCarIndices[1] ?? -1;
}

// 操作する車のインデックスを最後尾の車 (20番目) に設定
let playerCarIndex = NUM_CARS - 1; // const から let に変更し、initializeCarsで設定
let secondPlayerCarIndex = -1;
let playerCarIndices = [];


let keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    w: false,
    a: false,
    s: false,
    d: false,
    i: false,
    j: false,
    k: false,
    l: false,
    Numpad8: false,
    Numpad5: false,
    Numpad4: false,
    Numpad6: false
};

// カメラオフセット
let cameraOffsetX = 0;
let cameraOffsetY = 0;

// 接触時のカメラシェイク。強さは時間とともに滑らかに減衰する。
let cameraShakeStrength = 0;
let cameraShakeEndTime = 0;
const CAMERA_SHAKE_DURATION = 260;

function triggerCameraShake(strength = 8) {
    cameraShakeStrength = Math.max(cameraShakeStrength, strength);
    cameraShakeEndTime = performance.now() + CAMERA_SHAKE_DURATION;
}

function getCameraShakeOffset() {
    const remaining = Math.max(0, cameraShakeEndTime - performance.now());
    if (remaining <= 0) {
        cameraShakeStrength = 0;
        return { x: 0, y: 0 };
    }
    const decay = remaining / CAMERA_SHAKE_DURATION;
    const strength = cameraShakeStrength * decay * decay;
    return {
        x: (Math.random() * 2 - 1) * strength,
        y: (Math.random() * 2 - 1) * strength * 0.65
    };
}

// プレイヤーの現在の順位を保持する変数
let currentPlayerRank = 0;

// === カメラ設定 ===
const PLAYER_CAMERA_Y_POSITION_RATIO = 0.6; // プレイヤーの車を画面のどの高さの割合に表示するか (0.8から変更)

const TEAM_ACCENT_COLORS = {
    "Red Bull": "#3671c6", "McLaren": "#ff8000", "Ferrari": "#e8002d",
    "Mercedes": "#27f4d2", "Aston Martin": "#229971", "Williams": "#64c4ff",
    "Alpine": "#ff87bc", "VCARB": "#6692ff", "Kick Sauber": "#52e252", "Haas": "#b6babd"
};

const twoPlayerRaceButton = {
    x: 0, y: 0, width: 280, height: 58, text: "MULTIPLAYER",
    isVisible: false,
    isClicked: function(mouseX, mouseY) {
        return this.isVisible && mouseX >= this.x && mouseX <= this.x + this.width && mouseY >= this.y && mouseY <= this.y + this.height;
    }
};

const drsSettingButton = {
    x: 0, y: 0, width: 150, height: 36, isVisible: false,
    isClicked: function(mouseX, mouseY) {
        return this.isVisible && mouseX >= this.x && mouseX <= this.x + this.width && mouseY >= this.y && mouseY <= this.y + this.height;
    }
};

const courseSettingButton = {
    x: 0, y: 0, width: 220, height: 36, isVisible: false,
    isClicked: function(mouseX, mouseY) {
        return this.isVisible && mouseX >= this.x && mouseX <= this.x + this.width && mouseY >= this.y && mouseY <= this.y + this.height;
    }
};

const cpuSettingButton = {
    x: 0, y: 0, width: 170, height: 36, isVisible: false,
    isClicked: function(mouseX, mouseY) {
        return this.isVisible && mouseX >= this.x && mouseX <= this.x + this.width && mouseY >= this.y && mouseY <= this.y + this.height;
    }
};

const aiModeSettingButton = {
    x: 0, y: 0, width: 190, height: 36, isVisible: false,
    isClicked: function(mouseX, mouseY) {
        return this.isVisible && mouseX >= this.x && mouseX <= this.x + this.width && mouseY >= this.y && mouseY <= this.y + this.height;
    }
};

const multiplayerSetupButtons = {
    playerCounts: [2, 3, 4].map(count => ({ count, x: 0, y: 0, width: 110, height: 52 })),
    cpu: { x: 0, y: 0, width: 250, height: 52 },
    aiMode: { x: 0, y: 0, width: 250, height: 52 },
    start: { x: 0, y: 0, width: 250, height: 56 },
    back: { x: 20, y: 20, width: 100, height: 38 }
};

const MULTIPLAYER_COLORS = ['#ffe34d', '#7de9ff', '#ff75c8', '#88f06a'];
const MULTIPLAYER_CONTROL_LABELS = ['WASD', 'ARROWS', 'IJKL', 'NUM 8/5/4/6'];

function pointInRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function getDriverLastName(driver) {
    const fullName = (driver.fullName || driver.name || '').trim();
    const parts = fullName.split(/\s+/);
    return parts[parts.length - 1] || driver.name;
}

function getMultiplayerViewports(count = multiplayerPlayerCount) {
    if (count === 2) {
        return [
            { x: 0, y: 0, width: canvas.width / 2, height: canvas.height },
            { x: canvas.width / 2, y: 0, width: canvas.width / 2, height: canvas.height }
        ];
    }
    return Array.from({ length: count }, (_, index) => ({
        x: (index % 2) * canvas.width / 2,
        y: Math.floor(index / 2) * canvas.height / 2,
        width: canvas.width / 2,
        height: canvas.height / 2
    }));
}

function getAllSelectableDrivers() {
    const drivers = [];
    Object.entries(driverLineups).forEach(([teamName, team]) => {
        team.drivers.forEach(driver => drivers.push({ teamName, team, driver }));
    });
    return drivers;
}

function getMultiplayerDriverButtons(viewport) {
    const drivers = getAllSelectableDrivers();
    const columns = viewport.height >= 400 ? 2 : 4;
    const rows = Math.ceil(drivers.length / columns);
    const gap = 4;
    const top = viewport.y + 48;
    const side = 8;
    const width = (viewport.width - side * 2 - gap * (columns - 1)) / columns;
    const height = (viewport.height - 56 - gap * (rows - 1)) / rows;
    return drivers.map((entry, index) => ({
        ...entry,
        x: viewport.x + side + (index % columns) * (width + gap),
        y: top + Math.floor(index / columns) * (height + gap),
        width,
        height
    }));
}

function getQuickRaceSelectionLayout() {
    const columns = 5;
    const gapX = 10;
    const gapY = 12;
    const marginX = 20;
    const top = 92;
    const cardWidth = (canvas.width - marginX * 2 - gapX * (columns - 1)) / columns;
    const cardHeight = 174;
    return Object.keys(driverLineups).map((teamName, index) => ({
        teamName,
        team: driverLineups[teamName],
        x: marginX + (index % columns) * (cardWidth + gapX),
        y: top + Math.floor(index / columns) * (cardHeight + gapY),
        width: cardWidth,
        height: cardHeight
    }));
}

function drawPerformanceBar(x, y, width, label, factor, color) {
    const normalized = Math.max(0.12, Math.min(1, (factor - 0.88) / 0.20));
    ctx.font = '700 9px Arial';
    ctx.fillStyle = '#87909d';
    ctx.textAlign = 'left';
    ctx.fillText(label, x, y);
    ctx.fillStyle = '#2a3039';
    ctx.fillRect(x + 37, y - 7, width - 37, 5);
    ctx.fillStyle = color;
    ctx.fillRect(x + 37, y - 7, (width - 37) * normalized, 5);
}

const PERFORMANCE_GAP_MULTIPLIER = 1.5;

function amplifyPerformanceFactor(factor) {
    return 1 + (factor - 1) * PERFORMANCE_GAP_MULTIPLIER;
}

function getMachinePerformanceDisplay(team) {
    const topSpeedKmh = Math.round(carDefaults.maxSpeed * amplifyPerformanceFactor(team.maxSpeedFactor) * SPEED_TO_KMH_FACTOR);
    return {
        topSpeedKmh,
        lowSpeedAcceleration: amplifyPerformanceFactor(team.lowSpeedFactor || team.accelerationFactor),
        midSpeedAcceleration: amplifyPerformanceFactor(team.midSpeedFactor || team.accelerationFactor),
        highSpeedAcceleration: amplifyPerformanceFactor(team.highSpeedFactor || team.accelerationFactor)
    };
}

function getCurrentAccelerationFactor(car) {
    const speedRatio = car.maxSpeed > 0 ? Math.abs(car.speed) / car.maxSpeed : 0;
    if (speedRatio < 0.34) return car.lowSpeedFactor || 1.0;
    if (speedRatio < 0.72) return car.midSpeedFactor || 1.0;
    return car.highSpeedFactor || 1.0;
}

function beginSelectedRace() {
    initializeCars();
    gameState = 'signal_sequence';
    signalLightsOnCount = 0;
    lastSignalChangeTimestamp = Date.now();
    raceActualStartTime = 0;
    raceHistory = [];
    replayFrameIndex = 0;
    carsFinishedCount = 0;
    winnerFinishTime = 0;
    zoomLevelBeforeSignal = ZOOM_LEVEL;
    signalCameraPhase = 'locked_on_player';
    signalCameraScrollStartTime = Date.now();
}

// ====== イベントリスナー ======
document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase(); // WASDが大文字でも小文字として扱う
    const keyId = e.code && e.code.startsWith('Numpad') ? e.code : key;
    if (keys.hasOwnProperty(keyId) ||
        (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {

        // gameState が 'replay' の場合、特定のキーでリプレイ操作
        if (gameState === 'replay') {
            if (e.key === ' ') { // スペースキーで再生/一時停止
                isReplayPaused = !isReplayPaused;
                if (!isReplayPaused) {
                    lastReplayUpdateTime = Date.now(); // 再生再開時に時刻を更新
                }
            }
            // リプレイ操作以外のキーはデフォルト動作を抑制しない
        } else if (e.key.startsWith('Arrow') || (e.key === ' ' && gameState !== 'replay')) {
            if (gameState !== 'replay') { // リプレイ中以外でこれらのキーが押されたらデフォルト動作を抑制
                e.preventDefault();
            }
        }
        // Arrow keys are stored directly, WASD are stored as lowercase
        if (keys.hasOwnProperty(keyId)) keys[keyId] = true;
        else if (keys.hasOwnProperty(e.key)) keys[e.key] = true; // Fallback for original e.key if needed
    }
});

document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    const keyId = e.code && e.code.startsWith('Numpad') ? e.code : key;
    if (keys.hasOwnProperty(keyId)) keys[keyId] = false;
    else if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
});

// === キャンバス上のスライダー操作のためのイベントリスナー ===
function getMousePos(canvasDom, event) {
    const rect = canvasDom.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}

canvas.addEventListener('mousedown', (event) => {
    const mousePos = getMousePos(canvas, event);
    // スライダーのつまみの現在のY座標を計算
    const thumbY = sliderTrackY + ((ZOOM_LEVEL - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * (SLIDER_TRACK_HEIGHT - SLIDER_THUMB_HEIGHT);
    const sliderThumbX = sliderTrackX + (SLIDER_TRACK_WIDTH / 2) - (SLIDER_THUMB_WIDTH / 2);

    // つまみの上でマウスダウンされたかチェック
    if (mousePos.x >= sliderThumbX && mousePos.x <= sliderThumbX + SLIDER_THUMB_WIDTH &&
        mousePos.y >= thumbY && mousePos.y <= thumbY + SLIDER_THUMB_HEIGHT) {
        isDraggingZoomSlider = true;
        isDraggingScrollbar = false; // Ensure scrollbar dragging is off
    } else if (mousePos.x >= sliderTrackX && mousePos.x <= sliderTrackX + SLIDER_TRACK_WIDTH &&
               mousePos.y >= sliderTrackY && mousePos.y <= sliderTrackY + SLIDER_TRACK_HEIGHT) {
        // トラック上で直接クリックされた場合もドラッグ開始とし、値を更新
        isDraggingZoomSlider = true;
        isDraggingScrollbar = false; // Ensure scrollbar dragging is off
        updateZoomLevelFromMouse(mousePos.y);
    } else {
        // Check for scrollbar interaction if not dragging zoom slider
        let scrollbarParams = null;
        let currentScrollYVar = null;
        let setScrollYFunc = null;

        if (gameState === 'career_season_end' || gameState === 'career_team_standings') {
            scrollbarParams = getScrollbarRenderParams(
                gameState === 'career_season_end' ? (cars.length > 0 ? cars.length : NUM_CARS) * 25 : Object.keys(driverLineups).length * 25, // contentTotalHeight
                120, // scrollableAreaY
                canvas.height - 120 - 120, // scrollableAreaHeight
                careerSeasonEndScrollY
            );
            currentScrollYVar = careerSeasonEndScrollY;
            activeScrollbarScreen = gameState;
        } else if (gameState === 'career_machine_performance') {
            const teams = Object.keys(driverLineups);
            const numTeams = teams.length;
            const barHeight = 18; const barGap = 4; const teamGap = 12;
            const totalTeamBlockHeight = barHeight * 2 + barGap + teamGap;
            scrollbarParams = getScrollbarRenderParams(
                totalTeamBlockHeight * numTeams, // contentTotalHeight
                120, // scrollableAreaY (graphAreaY_local)
                canvas.height - 120 - 70, // scrollableAreaHeight
                careerMachinePerformanceScrollY
            );
            currentScrollYVar = careerMachinePerformanceScrollY;
            activeScrollbarScreen = gameState;
        }

        if (scrollbarParams && scrollbarParams.maxScroll > 0) {
            if (mousePos.x >= scrollbarParams.x && mousePos.x <= scrollbarParams.x + SCROLLBAR_WIDTH &&
                mousePos.y >= scrollbarParams.thumbY && mousePos.y <= scrollbarParams.thumbY + scrollbarParams.thumbHeight) {
                isDraggingScrollbar = true;
                isDraggingZoomSlider = false; // Ensure zoom slider dragging is off
                scrollbarDragStartMouseY = mousePos.y;
                scrollbarDragStartScrollY = currentScrollYVar;
                scrollbarTrackHeightForDrag = scrollbarParams.trackHeight;
                scrollbarThumbHeightForDrag = scrollbarParams.thumbHeight;
                scrollbarMaxScrollForDrag = scrollbarParams.maxScroll;
                event.preventDefault(); // Prevent text selection or other default actions
            }
        }
    }
});

canvas.addEventListener('mousemove', (event) => {
    if (isDraggingZoomSlider) {
        const mousePos = getMousePos(canvas, event);
        updateZoomLevelFromMouse(mousePos.y);
    } else if (isDraggingScrollbar) {
        const mousePos = getMousePos(canvas, event);
        const deltaMouseY = mousePos.y - scrollbarDragStartMouseY;
        let newScrollY = scrollbarDragStartScrollY;

        if (scrollbarTrackHeightForDrag - scrollbarThumbHeightForDrag > 0) {
            const scrollDeltaRatio = deltaMouseY / (scrollbarTrackHeightForDrag - scrollbarThumbHeightForDrag);
            newScrollY += scrollDeltaRatio * scrollbarMaxScrollForDrag;
        }

        newScrollY = Math.max(0, Math.min(newScrollY, scrollbarMaxScrollForDrag));

        if (activeScrollbarScreen === 'career_season_end' || activeScrollbarScreen === 'career_team_standings') {
            careerSeasonEndScrollY = newScrollY;
        } else if (activeScrollbarScreen === 'career_machine_performance') {
            careerMachinePerformanceScrollY = newScrollY;
        }
    }
});

canvas.addEventListener('mouseup', () => {
    if (isDraggingZoomSlider) {
        isDraggingZoomSlider = false;
    }
    if (isDraggingScrollbar) {
        isDraggingScrollbar = false;
        activeScrollbarScreen = null;
    }
});

canvas.addEventListener('mouseleave', () => {
    // isDraggingZoomSlider = false; // Keep dragging if mouse leaves and comes back while button is held
    // Similar for scrollbar, though less common. If mouseup is missed, this could be a fallback.
    // For now, rely on mouseup.
});

canvas.addEventListener('wheel', (event) => {
    if (gameState === 'career_season_end') {
        event.preventDefault();
        const scrollAmount = event.deltaY * 0.5;
        careerSeasonEndScrollY += scrollAmount;

        const listStartY = 120;
        const lineHeight = 25;
        const numDrivers = NUM_CARS; // ドライバーランキングのアイテム数
        const totalListContentHeight = numDrivers * lineHeight;
        const headerHeight = listStartY;
        const footerHeight = 120;
        const scrollableDisplayAreaHeight = canvas.height - headerHeight - footerHeight;
        let maxScrollY = Math.max(0, totalListContentHeight - scrollableDisplayAreaHeight);
        careerSeasonEndScrollY = Math.max(0, Math.min(careerSeasonEndScrollY, maxScrollY));

    } else if (gameState === 'career_team_standings') {
        event.preventDefault(); // デフォルトのページスクロールを防止
        const scrollAmount = event.deltaY * 0.5; // スクロール速度調整係数
        careerSeasonEndScrollY += scrollAmount;

        // スクロール範囲の制限
        const listStartY = 120; // drawCareerSeasonEndScreenでのリスト開始Y座標
        const lineHeight = 25;  // 各行の高さ
        // チームランキングのアイテム数 (driverLineupsのチーム数)
        const numTeams = Object.keys(driverLineups).length;
        const totalListContentHeight = numTeams * lineHeight; // Corrected: Actual height of the list items

        // スクロール可能な表示領域の高さ (ヘッダーとフッターボタンを除く)
        const headerHeight = listStartY;
        const footerHeight = 120; // Next Seasonボタンとその上のマージン程度
        const scrollableDisplayAreaHeight = canvas.height - headerHeight - footerHeight;

        let maxScrollY = 0;
        maxScrollY = Math.max(0, totalListContentHeight - scrollableDisplayAreaHeight);
        careerSeasonEndScrollY = Math.max(0, Math.min(careerSeasonEndScrollY, maxScrollY));
    } else if (gameState === 'career_machine_performance') {
        event.preventDefault();
        const scrollAmount = event.deltaY * 0.5;
        careerMachinePerformanceScrollY += scrollAmount;

        // These constants should match those in drawCareerMachinePerformanceScreen
        const graphAreaY_local = 120;
        const graphAreaHeight_local = canvas.height - graphAreaY_local - 70; // Bottom button margin (100 -> 70)

        const teams = Object.keys(driverLineups);
        const numTeams = teams.length;
        const barHeight = 18; const barGap = 4; const teamGap = 12;
        const totalTeamBlockHeight = barHeight * 2 + barGap + teamGap;
        const totalGraphContentHeight = totalTeamBlockHeight * numTeams; // Total height of the graph content

        let maxScrollY = 0;
        // maxScrollY is the total graph height minus the visible graph area height.
        // If all teams fit, maxScrollY will be 0 or negative, so Math.max(0, ...) handles it.
        maxScrollY = Math.max(0, totalGraphContentHeight - graphAreaHeight_local);

        careerMachinePerformanceScrollY = Math.max(0, Math.min(careerMachinePerformanceScrollY, maxScrollY));
    }
});

// グローバル変数として、セーブ処理中に一時的に使用するセーブデータを保持
let dataPreparedForSaving = null;

canvas.addEventListener('click', (event) => {
    const mousePos = getMousePos(canvas, event);

    // 汎用セーブボタンのクリック判定 (最優先)
    if (generalSaveButton.isClicked(mousePos.x, mousePos.y)) {
        // TODO: セーブ画面に入る前の gameState を保存しておき、セーブキャンセル時に戻れるようにする
        previousGameStateBeforeSaveLoad = gameState; // (例)

        if (gameState === 'all_finished' && careerPlayerTeamName) {
            // 'all_finished' からのセーブで、「次のレースから開始」するための特別処理
            const backup = {
                currentSeasonNumber: currentSeasonNumber,
                currentRaceInSeason: currentRaceInSeason,
                currentRaceType: JSON.parse(JSON.stringify(currentRaceType)),
                chosenPlayerInfo: JSON.parse(JSON.stringify(chosenPlayerInfo)),
                driverLineups: JSON.parse(JSON.stringify(driverLineups)),
                reserveAndF2Drivers: JSON.parse(JSON.stringify(reserveAndF2Drivers)),
                careerDriverSeasonPoints: JSON.parse(JSON.stringify(careerDriverSeasonPoints)),
                careerTeamSeasonPoints: JSON.parse(JSON.stringify(careerTeamSeasonPoints)),
                previousRaceFinishingOrder: JSON.parse(JSON.stringify(previousRaceFinishingOrder)),
            };

            let stateToSaveAs;
            if (currentRaceInSeason < RACES_PER_SEASON) { // シーズン中の次のレース
                currentRaceInSeason++;
                initializeRaceSettings(currentRaceInSeason); // GOAL_LINE_Y_POSITION と currentRaceType を更新
                stateToSaveAs = 'career_machine_performance';
            } else { // シーズン終了、次のシーズンの準備
                // ドライバー成長・加齢処理 (グローバル変数を変更)
                handleDriverDevelopmentAndAging();

                // AI移籍処理 (グローバル変数を変更)
                // careerTeamSeasonPoints は終了したシーズンのものを使用 (ティア更新のため)
                // careerPlayerTeamName は現シーズンのプレイヤーのチーム (移籍ロジックでのプレイヤー配置のため)
                driverLineups = handleAiDriverTransfers(
                    driverLineups, // 成長・加齢処理後のラインナップ
                    backup.careerTeamSeasonPoints, // 終了したシーズンのチームポイント
                    careerPlayerTeamName,          // 現シーズン(終了直後)のプレイヤーのチーム
                    chosenPlayerInfo.driverName,   // 成長・加齢処理後のプレイヤー名
                    reserveAndF2Drivers            // 成長・加齢処理後のリザーブ
                );

                currentSeasonNumber++;
                currentRaceInSeason = 1;
                careerDriverSeasonPoints = {}; // 新シーズンのためリセット
                careerTeamSeasonPoints = {};   // 新シーズンのためリセット
                previousRaceFinishingOrder = []; // 新シーズンのためリセット
                initializeRaceSettings(currentRaceInSeason); // 新シーズンの最初のレース設定
                stateToSaveAs = 'career_machine_performance';
            }

            dataPreparedForSaving = gatherSaveData(stateToSaveAs); // 更新されたグローバル変数と指定されたgameStateでセーブデータ作成

            // グローバル変数をバックアップから復元
            currentSeasonNumber = backup.currentSeasonNumber;
            currentRaceInSeason = backup.currentRaceInSeason;
            currentRaceType = backup.currentRaceType;
            chosenPlayerInfo = backup.chosenPlayerInfo;
            driverLineups = backup.driverLineups;
            reserveAndF2Drivers = backup.reserveAndF2Drivers;
            careerDriverSeasonPoints = backup.careerDriverSeasonPoints;
            careerTeamSeasonPoints = backup.careerTeamSeasonPoints;
            previousRaceFinishingOrder = backup.previousRaceFinishingOrder;
            initializeRaceSettings(currentRaceInSeason); // 実際の現在のレース状態に再設定
        } else {
            dataPreparedForSaving = gatherSaveData(gameState); // 通常のセーブ
        }
        gameState = 'save_game_selection';
        return; // 他のクリックイベントをここで止める
    }

    if (gameState === 'title_screen') {
        if (aiModeSettingButton.isClicked(mousePos.x, mousePos.y)) {
            aiDrivingMode = aiDrivingMode === 'real' ? 'easy' : 'real';
            saveQuickRaceSettings();
            return;
        }
        if (courseSettingButton.isClicked(mousePos.x, mousePos.y)) {
            selectedQuickRaceCourseIndex = (selectedQuickRaceCourseIndex + 1) % SEASON_SCHEDULE.length;
            applyCourseSettings(SEASON_SCHEDULE[selectedQuickRaceCourseIndex]);
            saveQuickRaceSettings();
            return;
        }
        if (drsSettingButton.isClicked(mousePos.x, mousePos.y)) {
            drsEnabled = !drsEnabled;
            saveQuickRaceSettings();
            return;
        }
        if (quickRaceButton.isClicked(mousePos.x, mousePos.y)) {
            applyCourseSettings(SEASON_SCHEDULE[selectedQuickRaceCourseIndex]);
            gameState = 'driver_selection';
            raceMode = 'single';
            versusSelectionPlayer = 1;
            chosenPlayer2Info = null;
            multiplayerSelections = [];
            quickRaceButton.isVisible = false;
            twoPlayerRaceButton.isVisible = false;
            careerModeButton.isVisible = false;
            careerPlayerTeamName = null; // クイックレース選択時はキャリア情報をリセット
            console.log("Quick Race selected. Proceeding to driver selection.");
            return;
        }
        if (twoPlayerRaceButton.isClicked(mousePos.x, mousePos.y)) {
            applyCourseSettings(SEASON_SCHEDULE[selectedQuickRaceCourseIndex]);
            raceMode = 'versus';
            careerPlayerTeamName = null;
            gameState = 'multiplayer_setup';
            quickRaceButton.isVisible = false;
            twoPlayerRaceButton.isVisible = false;
            return;
        }
        return; // タイトル画面でボタン以外をクリックした場合は何もしない
    }

    if (gameState === 'multiplayer_setup') {
        if (pointInRect(mousePos.x, mousePos.y, multiplayerSetupButtons.back)) {
            gameState = 'title_screen';
            return;
        }
        for (const button of multiplayerSetupButtons.playerCounts) {
            if (pointInRect(mousePos.x, mousePos.y, button)) {
                multiplayerPlayerCount = button.count;
                saveQuickRaceSettings();
                return;
            }
        }
        if (pointInRect(mousePos.x, mousePos.y, multiplayerSetupButtons.cpu)) {
            cpuOpponentsEnabled = !cpuOpponentsEnabled;
            saveQuickRaceSettings();
            return;
        }
        if (pointInRect(mousePos.x, mousePos.y, multiplayerSetupButtons.aiMode)) {
            aiDrivingMode = aiDrivingMode === 'real' ? 'easy' : 'real';
            saveQuickRaceSettings();
            return;
        }
        if (pointInRect(mousePos.x, mousePos.y, multiplayerSetupButtons.start)) {
            multiplayerSelections = Array(multiplayerPlayerCount).fill(null);
            chosenPlayer2Info = null;
            gameState = 'driver_selection';
            return;
        }
        return;
    }

    if (gameState === 'career_team_selection') {
        const titleHeight = 80;
        const itemHeight = 50;
        const itemPadding = 20;
        const buttonWidth = 300;
        const buttonHeight = 40; // クリック判定用の高さ (描画時の itemHeight と合わせる)
        const startY = 120; // drawCareerTeamSelectionScreen の描画開始Yと合わせる

        careerModeAvailableTeams.forEach((teamName, index) => {
            const buttonX = canvas.width / 2 - buttonWidth / 2;
            // 描画時のボタンY座標と合わせる
            const buttonY = startY + index * (itemHeight + itemPadding); // itemHeight はボタンの描画高さ

            if (mousePos.x >= buttonX && mousePos.x <= buttonX + buttonWidth &&
                mousePos.y >= buttonY && mousePos.y <= buttonY + itemHeight) { // クリック判定は itemHeight を使用

                careerPlayerTeamName = teamName;
                chosenPlayerInfo.teamName = teamName; // ドライバー選択画面でこのチームをデフォルト表示するため
                // chosenPlayerInfo.driverName はキャリアモードで既に設定されているので、ここではnullにしない
                chosenPlayerInfo.imageName = driverLineups[teamName].image; // チームの画像名を設定

                // --- 自動的にセカンドドライバーのスロットに割り当てる ---
                const teamData = driverLineups[careerPlayerTeamName];
                if (teamData && teamData.drivers.length > 1) {
                    chosenPlayerInfo.rating = teamData.drivers[1].rating; // セカンドドライバーのレーティング
                } else if (teamData && teamData.drivers.length === 1) { // ドライバーが1人のチームの場合
                    chosenPlayerInfo.rating = teamData.drivers[0].rating;
                } else {
                    console.error(`Team data for ${careerPlayerTeamName} not found or has no drivers.`);
                    gameState = 'driver_selection'; // エラー時はドライバー選択に戻す
                    return;
                }
                // chosenPlayerInfo.salary = calculateDriverSalary(chosenPlayerInfo.rating); // 契約金を計算 ← プレイヤーは常に0なので不要
                chosenPlayerInfo.salary = 0; // プレイヤーの契約金を0に設定

                if (driverLineups[careerPlayerTeamName].funds >= chosenPlayerInfo.salary) {
                    // driverLineups[careerPlayerTeamName].funds -= chosenPlayerInfo.salary; // 資金控除はオファー受諾画面へ移動
                    alert(`${careerPlayerTeamName} を選択しました。給与は $${chosenPlayerInfo.salary.toLocaleString()} です。\nパフォーマンス画面へ進み、最終確認後に契約となります。`);
                    // initializeCars(); // マシンパフォーマンス画面の後に移動
                    gameState = 'career_machine_performance'; // マシンパフォーマンス画面へ
                    console.log(`Career mode: Team ${careerPlayerTeamName} selected. Player salary $${chosenPlayerInfo.salary}. Proceeding to machine performance.`);
                } else {
                    alert(`${careerPlayerTeamName} はあなたの給与 $${chosenPlayerInfo.salary.toLocaleString()} を支払うための資金が不足しています (現在の資金: $${driverLineups[careerPlayerTeamName].funds.toLocaleString()})。\n他のチームを選択してください。`);
                    console.warn(`Career mode: Team ${careerPlayerTeamName} (Funds: $${driverLineups[careerPlayerTeamName].funds}) cannot afford player salary $${chosenPlayerInfo.salary}.`);
                    // gameState は変更せず、再度チーム選択を促す
                }
                return;
            }
        });
        return; // チーム選択画面でのクリック処理はここまで
    }

    if (gameState === 'all_finished') {
        if (careerPlayerTeamName) { // キャリアモードの場合
            // 「NEXT」ボタンのクリック判定を優先
            if (careerNextButton.isClicked(mousePos.x, mousePos.y)) {
                gameState = 'career_season_end'; // ドライバーポイント表示画面へ
                careerNextButton.isVisible = false; // NEXTボタンを非表示
                replayButton.isVisible = false; // リプレイボタンも非表示にする
                careerSeasonEndScrollY = 0; // スクロールリセット
                console.log("NEXT button clicked, showing driver standings.");
                return;
            }
            // リプレイボタンのクリック判定 (NEXTボタンが押されなかった場合)
            // この後の共通リプレイボタン処理に任せるため、ここでは return しない
            if (replayButton.isVisible && replayButton.isClicked(mousePos.x, mousePos.y)) {
                // gameState = 'replay'; // 共通処理で対応
            }
        } else { // クイックレースの場合 (careerPlayerTeamName === null)
            // クイックレースの「Back」ボタンのクリック判定
            if (quickRaceBackButton.isClicked(mousePos.x, mousePos.y)) {
                gameState = 'title_screen';
                raceMode = 'single';
                versusSelectionPlayer = 1;
                chosenPlayer2Info = null;
                cars = [];
                raceHistory = [];
                replayFrameIndex = 0;
                carsFinishedCount = 0;
                winnerFinishTime = 0;
                quickRaceBackButton.isVisible = false;
                replayButton.isVisible = false;
                careerNextButton.isVisible = false;
                careerReplayBackButton.isVisible = false;
                careerReplayAgainButton.isVisible = false;
                applyCourseSettings(SEASON_SCHEDULE[selectedQuickRaceCourseIndex]);
                canvas.style.cursor = 'default';
                console.log("Quick Race: returned to title screen.");
                return;
            }
        }
    } else if (gameState === 'career_season_end' && careerPlayerTeamName) {
        // ボタンのテキストと機能は drawCareerSeasonEndScreen で動的に設定される
        const actionButton = { // このボタンの定義は描画関数と合わせる
            x: canvas.width / 2 - 150,
            y: canvas.height - 100,
            width: 300,
            height: 50,
        };
        if (mousePos.x >= actionButton.x && mousePos.x <= actionButton.x + actionButton.width &&
            mousePos.y >= actionButton.y && mousePos.y <= actionButton.y + actionButton.height) {

            if (currentRaceInSeason < RACES_PER_SEASON) { // 「Next Race」ボタンが押された場合
                // このボタンは `career_season_end` (ドライバーランキング) 画面のボタン
                // チームランキング画面へ遷移する
                gameState = 'career_team_standings';
                careerSeasonEndScrollY = 0; // スクロールリセット
                console.log(`Proceeding to team standings view for Season ${currentSeasonNumber}, Race ${currentRaceInSeason}/${RACES_PER_SEASON}`);
            } else { // 「View Team Offers」ボタンが押された場合 (シーズン終了時のドライバーランキング画面)
                // このボタンも `career_season_end` (ドライバーランキング) 画面のボタン
                // チームランキング画面へ遷移する
                gameState = 'career_team_standings';
                careerSeasonEndScrollY = 0; // スクロールリセット
                console.log(`Season ${currentSeasonNumber} ended. Proceeding to final team standings view.`);
            }
            return;
        }
    } else if (gameState === 'career_team_standings' && careerPlayerTeamName) {
        const actionButton = { /* ... drawCareerTeamStandingsScreen と同じ定義 ... */
            x: canvas.width / 2 - 150, y: canvas.height - 100, width: 300, height: 50,
        };
        if (mousePos.x >= actionButton.x && mousePos.x <= actionButton.x + actionButton.width &&
            mousePos.y >= actionButton.y && mousePos.y <= actionButton.y + actionButton.height) {
            if (currentRaceInSeason < RACES_PER_SEASON) { // 「Next Race」ボタン (チームランキング画面)
                currentRaceInSeason++;
                careerSeasonEndScrollY = 0; // スクロールリセット
                // previousSeasonPointsForDisplay = JSON.parse(JSON.stringify(careerTeamSeasonPoints)); // マシンパフォーマンス表示用に現在のポイントを保持 <- 昨シーズンのポイントを維持するため削除
                initializeRaceSettings(currentRaceInSeason); // レースタイプ設定はここ
                gameState = 'career_machine_performance'; // マシンパフォーマンス画面へ
                // signal_sequence への遷移はロスタースクリーンのボタンで行う
                console.log(`Proceeding to next race setup: Season ${currentSeasonNumber}, Race ${currentRaceInSeason}/${RACES_PER_SEASON}`);
            } else { // 「View Team Offers」ボタン (シーズン終了時のチームランキング画面)
                // drawCareerSeasonEndScreen のシーズン終了時と同じロジックでリザルトデータを生成
                let tempAllDriversData = [];
                // driverLineups からAIドライバーの情報を収集
                for (const teamName in driverLineups) { // この時点のdriverLineupsは前シーズンのもの
                    const team = driverLineups[teamName];
                    team.drivers.forEach((driver) => {
                        // プレイヤーの情報は別途 chosenPlayerInfo から取得するため、
                        // ここでプレイヤー自身 (chosenPlayerInfo.driverName と一致するドライバー) はスキップする。
                        // プレイヤーがどのチームにいたとしても、chosenPlayerInfo.driverNameで識別する。
                        if (driver.name === chosenPlayerInfo.driverName) {
                            return; 
                        }
                        const points = careerDriverSeasonPoints[driver.name] || 0;
                        tempAllDriversData.push({
                            shortName: driver.name,
                            fullName: driver.fullName,
                            points: points,
                            isPlayer: false 
                        });
                    });
                }
                // プレイヤー自身の情報を chosenPlayerInfo から取得して追加
                const playerPoints = careerDriverSeasonPoints[chosenPlayerInfo.driverName] || 0;
                tempAllDriversData.push({
                    shortName: chosenPlayerInfo.driverName,
                    fullName: chosenPlayerInfo.fullName,
                    points: playerPoints,
                    isPlayer: true
                });

                // ポイントでソートしてプレイヤーの順位を決定
                tempAllDriversData.sort((a, b) => b.points - a.points);
                playerLastSeasonRank = tempAllDriversData.findIndex(d => d.isPlayer) + 1;
                if (playerLastSeasonRank === 0) { // プレイヤーが見つからない場合 (ありえないはずだが念のため)
                    console.error("Player not found in season end ranking for offer generation!");
                    playerLastSeasonRank = tempAllDriversData.length; // 最下位扱い
                }

                // === 新規ドライバー生成 (シーズン終了時のみ) ===
                if (currentSeasonNumber >= 3) { // シーズン3以降で生成
                    for (let i = 0; i < NUM_NEW_DRIVERS_PER_SEASON; i++) {
                        const newDriver = generateNewDriver();
                        reserveAndF2Drivers.push(newDriver);
                        console.log(`Generated new driver for next season: ${newDriver.fullName} (Nat: ${newDriver.nationality}, Rating: ${newDriver.rating}, Age: ${newDriver.age})`);
                    }
                }
                // === 新規ドライバー生成ここまで ===

                console.log(`Player finished season ${currentSeasonNumber} in rank: ${playerLastSeasonRank}`);

                // Calculate next season's tiers for offer generation
                // Use the *current* driverLineups (which reflects the team structure)
                // and the *finished* season's team points (careerTeamSeasonPoints)
                nextSeasonTiersForOfferDisplay = calculateNextSeasonTeamTiers(
                    driverLineups, // Current driverLineups (reflects team structure)
                    careerTeamSeasonPoints // Finished season's team points
                );

                console.log("Calculated next season team tiers for offer generation:", nextSeasonTiersForOfferDisplay);
                // オファールールに基づいてオファーチームを生成
                offeredTeams = generateTeamOffers(playerLastSeasonRank, careerPlayerTeamName ? driverLineups[careerPlayerTeamName].tier : 5, nextSeasonTiersForOfferDisplay);

                // === ドライバー成長・加齢処理 ===
                console.log("Before development/aging: Player Age:", chosenPlayerInfo.age, "Rating:", chosenPlayerInfo.rating);
                handleDriverDevelopmentAndAging(); // グローバル変数を直接更新
                console.log("After development/aging: Player Age:", chosenPlayerInfo.age, "Rating:", chosenPlayerInfo.rating);
                chosenPlayerInfo.salary = 0; // プレイヤーの契約金を0に設定
                // === 成長・加齢処理ここまで ===
                gameState = 'career_team_offers'; // チームオファー画面へ
            }
            return;
        }
    }

    if (gameState === 'career_team_offers' && careerPlayerTeamName) { // careerPlayerTeamName は前シーズンのもの
        let offerSuccessfullyAccepted = false; // オファーが正常に承諾されたかどうかのフラグ
        const startY = 120;
        const availableHeight = canvas.height - startY - 20; // 下に20pxのマージン
        const numOffers = offeredTeams.length > 0 ? offeredTeams.length : 1;

        let buttonHeight = 50;
        let buttonPadding = 15;
        const buttonWidth = 350;

        // オファー数に応じてボタンサイズを動的に調整 (描画ロジックと一致させる)
        const totalRequiredHeight = numOffers * (buttonHeight + buttonPadding) - buttonPadding;
        if (totalRequiredHeight > availableHeight && numOffers > 0) {
            const totalItemHeight = availableHeight / numOffers;
            buttonHeight = totalItemHeight * 0.85;
            buttonPadding = totalItemHeight * 0.15;
        }

        offeredTeams.forEach((teamName, index) => {
            if (offerSuccessfullyAccepted) return; // 既にオファーが承諾されていれば、他のオファーの判定はスキップ

            const buttonX = canvas.width / 2 - buttonWidth / 2;
            const buttonY = startY + index * (buttonHeight + buttonPadding);

            if (mousePos.x >= buttonX && mousePos.x <= buttonX + buttonWidth &&
                mousePos.y >= buttonY && mousePos.y <= buttonY + buttonHeight) {

                // プレイヤーの契約金を計算 (新しいシーズンに基づいて)
                // currentSeasonNumber はこの時点では終了したシーズンを指す
                let playerContractualSalary;
                if ((currentSeasonNumber + 1) > 1) { // 新しいシーズンが2シーズン目以降の場合
                    playerContractualSalary = calculateDriverSalary(75);
                } else {
                    // 新しいシーズンが1シーズン目の場合 (通常オファー画面からはこのルートに来ないはず)
                    playerContractualSalary = 0;
                }

                if (driverLineups[teamName].funds >= playerContractualSalary) {
                    offerSuccessfullyAccepted = true; // 契約成立フラグ

                    // 前シーズンのチームポイントを保持 (マシンアップグレードとティア更新のため)
                    const previousSeasonTeamPoints = JSON.parse(JSON.stringify(careerTeamSeasonPoints));
                    previousSeasonPointsForDisplay = previousSeasonTeamPoints; // マシンパフォーマンス表示用に前シーズンのポイントを保持

                    // 新しいシーズンへの準備
                    currentSeasonNumber++;
                    currentRaceInSeason = 1;
                    careerDriverSeasonPoints = {}; // ポイントリセット
                    careerTeamSeasonPoints = {};   // チームポイントもリセット
                    previousRaceFinishingOrder = []; // 新シーズンのため前レース結果をリセット

                    careerPlayerTeamName = teamName; // 新しいチームを設定
                    chosenPlayerInfo.teamName = teamName;
                    chosenPlayerInfo.imageName = driverLineups[teamName].image; // 新しいチームの画像名
                    chosenPlayerInfo.salary = playerContractualSalary; // プレイヤーの契約情報を更新

                    driverLineups[teamName].funds -= playerContractualSalary; // プレイヤーの給与は0なので、実質引かれない
                    console.log(`Player ${chosenPlayerInfo.driverName} signed with ${teamName}. Salary: $${playerContractualSalary.toLocaleString()} deducted. New team funds: $${driverLineups[teamName].funds.toLocaleString()}`);

                    // AI移籍とマシンパフォーマンス更新はオファー承諾後にまとめて行う

                } else {
                    alert(`チーム ${teamName} はあなたの契約金 $${playerContractualSalary.toLocaleString()} を支払う資金がありません (現在の資金: $${driverLineups[teamName].funds.toLocaleString()})。このチームとは契約できません。`);
                    console.warn(`Team ${teamName} (Funds: $${driverLineups[teamName].funds.toLocaleString()}) cannot afford player ${chosenPlayerInfo.driverName} (Salary: $${playerContractualSalary.toLocaleString()}). Contract not signed.`);
                    // offerSuccessfullyAccepted は false のまま。gameState も変更しない。
                    return; // このオファーの処理を中断
                }
            }
        });

        if (offerSuccessfullyAccepted) {
            // === AI移籍とマシンパフォーマンス更新をここで行う ===
            // driverLineups は handleDriverDevelopmentAndAging で更新済み
            // careerTeamSeasonPoints は前シーズンのものが previousSeasonPointsForDisplay に保持されている
            // careerPlayerTeamName は新しいチーム名
            // chosenPlayerInfo.driverName は更新済み
            // reserveAndF2Drivers は更新済み
            driverLineups = handleAiDriverTransfers(
                driverLineups,
                previousSeasonPointsForDisplay, // 保持しておいた前シーズンのポイントを使用
                careerPlayerTeamName,           // 新しいプレイヤーのチーム名
                chosenPlayerInfo.driverName,
                reserveAndF2Drivers
            );

            // === シーズン終了ボーナス: 全チームに資金を付与 ===
            console.log("--- Awarding end-of-season funds to all teams ---");
            for (const teamKey in driverLineups) {
                if (driverLineups.hasOwnProperty(teamKey)) {
                    driverLineups[teamKey].funds += 1000000;
                    console.log(`Team ${teamKey} received $1,000,000. New funds: $${driverLineups[teamKey].funds.toLocaleString()}`);
                }
            }
            console.log("--- End-of-season funds awarded ---");

            initializeRaceSettings(currentRaceInSeason);

            // チーム選択後、プレイヤーのレーティングと年齢は handleDriverDevelopmentAndAging で更新された値を維持

            // 新しいシーズンへの準備 (移籍処理後)
            console.log(`INFO: You have signed with ${careerPlayerTeamName} for Season ${currentSeasonNumber}!`);
            gameState = 'career_machine_performance'; // マシンパフォーマンス画面へ
            console.log(`Starting new season ${currentSeasonNumber} with team ${careerPlayerTeamName}.`);

            playerLastSeasonRank = 0; // 新シーズンに向けてリセット
            offeredTeams = [];       // オファー情報をクリア
            return; // オファーが処理された場合、メインのクリックハンドラから抜ける
        }

        // オファーがクリックされず、かつオファーリストが空の場合の処理 (変更なし)
        if (offeredTeams.length === 0 && !offerSuccessfullyAccepted) {
            // TODO: キャリア終了処理 or 強制的に下位チームへなど
            alert("No teams offered a contract. Career Over (WIP).");
            gameState = 'driver_selection'; // とりあえずドライバー選択に戻る
        }
    }

    // gameState === 'career_machine_performance' の場合のクリック処理 (NEXTボタン)
    if (gameState === 'career_machine_performance' && careerMachinePerformanceNextButton.isClicked(mousePos.x, mousePos.y)) {
        // isTransitioningToNewSeason は、オファー画面から来たかどうかで判定
        // currentRaceInSeason はオファー受諾時またはシーズン中の次のレース準備時に設定されている
        // currentSeasonNumber はオファー受諾時にインクリメントされている

        // キャリア初期のチーム選択からの遷移の場合、ここで契約金を処理
        if (currentSeasonNumber === 1 && currentRaceInSeason === 1 && !offeredTeams.length) { // offeredTeamsが空なら初期選択
            // chosenPlayerInfo.salary はチーム選択時に0に設定済み
            // 契約に使用するプレイヤーの給与は常に0とする
            const playerContractualSalary = 0;
            if (driverLineups[careerPlayerTeamName].funds >= playerContractualSalary) {
                driverLineups[careerPlayerTeamName].funds -= playerContractualSalary; // プレイヤーの給与は0なので、実質引かれない
                alert(`${careerPlayerTeamName} と正式に契約しました。給与 $${playerContractualSalary.toLocaleString()} が差し引かれました。\n現在のチーム資金: $${driverLineups[careerPlayerTeamName].funds.toLocaleString()}`);
                console.log(`Career mode: Player ${chosenPlayerInfo.driverName} officially signed with ${careerPlayerTeamName}. Salary $${playerContractualSalary} deducted. Funds: $${driverLineups[careerPlayerTeamName].funds}`);
            } else {
                // このケースは通常、チーム選択画面でブロックされるはずだが、念のため
                alert(`エラー: ${careerPlayerTeamName} はあなたの給与を支払えません。チーム選択に戻ります。`);
                gameState = 'career_team_selection';
                return;
            }
        }

        // マシンパフォーマンスの更新とAI移籍は、この画面に来る前 (オファー受諾時) に完了している。
        // よって、ここでの handleAiDriverTransfers の呼び出しは不要。

        if (currentRaceInSeason === 1) { // 新シーズンの最初のレース、またはキャリア最初のレース
            console.log("INFO: Machine Performance -> Roster (New Season Start or First Season Start)");
        } else {
            console.log("INFO: Machine Performance -> Roster (Mid-Season or First Season Start)");
        }

        initializeCars(); // AI移籍処理後、または移籍がない場合に車を初期化
        gameState = 'career_roster';
        careerMachinePerformanceNextButton.isVisible = false;
        return;
    }


    // gameState === 'career_roster' の場合のクリック処理 (シーズン開始ボタン)
    if (gameState === 'career_roster' && careerStartSeasonButton.isClicked(mousePos.x, mousePos.y)) {
        gameState = 'signal_sequence'; // シグナルシーケンスへ
        // レース開始のための各種リセット処理
        signalLightsOnCount = 0;
        lastSignalChangeTimestamp = Date.now();
        // SIGNAL_ALL_LIGHTS_ON_DURATION = Math.random() * 1000 + 500; // DEBUG: 固定値を使用するためコメントアウト
        raceActualStartTime = 0;
        raceHistory = [];
        replayFrameIndex = 0;
        carsFinishedCount = 0;
        winnerFinishTime = 0;

        replayButton.isVisible = false;
        careerNextButton.isVisible = false;
        careerStartSeasonButton.isVisible = false; // このボタンも非表示に

        generalSaveButton.isVisible = false; // レースシーケンスに入る前にセーブボタンを非表示にします
        console.log(`Starting race for Season ${currentSeasonNumber}, Race ${currentRaceInSeason}.`);

        // === シグナルシーケンス用カメラ初期化 ===
        zoomLevelBeforeSignal = ZOOM_LEVEL;
        ZOOM_LEVEL = zoomLevelBeforeSignal; // プレイヤー追尾開始時からレース前のズームレベルを適用

        // signalCameraPhase を 'locked_on_player' に直接設定し、スクロールとズームアニメーションをスキップ
        signalCameraPhase = 'locked_on_player';
        signalCameraScrollStartTime = Date.now();
        // initialSignalZoom や SIGNAL_CAMERA_GRID_VIEW_DURATION の計算と使用は不要になります。
        // === カメラ初期化ここまで ===
        return;
    }

    // === セーブ画面のクリック処理 ===
    if (gameState === 'save_game_selection') {
        if (backButton.isClicked(mousePos.x, mousePos.y)) {
            gameState = previousGameStateBeforeSaveLoad || 'title_screen';
            previousGameStateBeforeSaveLoad = null; // 使用後はクリア
            generalSaveButton.isVisible = false; // セーブボタンを非表示に戻す
            return;
        }
        // スロットクリック処理 (drawSaveLoadScreen と連携)
        const slotClickedIndex = getClickedSlotIndex(mousePos.x, mousePos.y);
        if (slotClickedIndex !== -1) {
            selectedSlotForAction = slotClickedIndex;
            const slotMeta = saveSlotsMetadata[selectedSlotForAction];
            let performSave = false;
            if (slotMeta.isEmpty) {
                performSave = true;
            } else {
                // 確認なしで上書き
                performSave = true;
                // もし確認を残す場合は以下のコメントを解除
                // if (confirm(`スロット ${selectedSlotForAction + 1} のデータ「${slotMeta.name}」を上書きしますか？`)) {
                //     performSave = true;
                // }
            }

            if (performSave) {
                if (!dataPreparedForSaving) {
                    // 通常ここには来ないはずだが、フォールバックとして現在の状態を保存
                    console.warn("dataPreparedForSaving was null, creating fallback save data.");
                    dataPreparedForSaving = gatherSaveData(previousGameStateBeforeSaveLoad || 'title_screen');
                }
                saveGameToSlot(selectedSlotForAction, dataPreparedForSaving);
                dataPreparedForSaving = null; // 使用後はクリア
                loadSaveSlotsMetadata(); // メタデータを更新
                // gameState = 'career_machine_performance'; // セーブ後は元の画面に戻る
                gameState = previousGameStateBeforeSaveLoad || 'title_screen';
                previousGameStateBeforeSaveLoad = null; // クリア
            }
        }
        return; // セーブ画面のクリック処理はここまで
    }

    // === ロード画面のクリック処理 ===
    if (gameState === 'load_game_selection') {
        if (backButton.isClicked(mousePos.x, mousePos.y)) {
            gameState = 'title_screen';
            previousGameStateBeforeSaveLoad = null; // 使用後はクリア
            // generalSaveButton.isVisible = false; // タイトル画面では通常表示されない
            return;
        }
        if (deleteAllSavesButton.isClicked(mousePos.x, mousePos.y)) {
            if (confirm("本当にすべてのセーブデータを削除しますか？この操作は元に戻せません。")) {
                if (confirm("最終確認：すべてのセーブデータを完全に削除します。よろしいですか？")) {
                    localStorage.removeItem(ALL_SAVES_KEY);
                    loadSaveSlotsMetadata(); // メタデータを再読み込みして画面を更新
                    alert("すべてのセーブデータが削除されました。");
                } else {
                    alert("削除はキャンセルされました。");
                }
            } else {
                alert("削除はキャンセルされました。");
            }
            return;
        }
        const slotClickedIndex = getClickedSlotIndex(mousePos.x, mousePos.y);
        if (slotClickedIndex !== -1 && !saveSlotsMetadata[slotClickedIndex].isEmpty) {
            selectedSlotForAction = slotClickedIndex;

            // データを直接ロードして、名前変更の機会を設ける
            const allSavesRaw = localStorage.getItem(ALL_SAVES_KEY);
            let loadedData = null;
            if (allSavesRaw) {
                try {
                    const allSaves = JSON.parse(allSavesRaw);
                    if (Array.isArray(allSaves) && allSaves[slotClickedIndex]) {
                        loadedData = allSaves[slotClickedIndex];
                    }
                } catch (e) {
                    console.error("Error parsing save data during load attempt:", e);
                }
            }

            if (!loadedData) {
                alert(`スロット ${slotClickedIndex + 1} からのロードに失敗しました。`);
                return;
            }

            // プレイヤー名変更のプロンプト
            if (confirm("プレイヤー名を変更しますか？")) {
                // 変更前のプレイヤー情報を取得
                const oldPlayerShortName = loadedData.chosenPlayerInfo.driverName;
                const savedCareerName = loadedData.careerPlayerName || { firstName: "Player", lastName: "One" };

                const newFirstName = prompt("新しい名を入力してください:", savedCareerName.firstName);
                if (newFirstName !== null && newFirstName.trim() !== "") {
                    const newLastName = prompt("新しい姓を入力してください:", savedCareerName.lastName);
                    if (newLastName !== null && newLastName.trim() !== "") {
                        const defaultShortName = newLastName.trim().substring(0, 3).toUpperCase();
                        const shortNameInput = prompt(`新しい3文字表記を入力してください (3文字の英大文字または数字):`, defaultShortName);
                        let finalShortName = defaultShortName;

                        if (shortNameInput !== null && shortNameInput.trim().length === 3 && /^[A-Z0-9]{3}$/.test(shortNameInput.trim().toUpperCase())) {
                            finalShortName = shortNameInput.trim().toUpperCase();
                        } else {
                            alert("3文字表記が無効です。デフォルト値を使用します。");
                        }

                        // 新しい名前が他のドライバーと重複していないかチェック
                        const isNameTaken = Object.values(loadedData.driverLineups).flatMap(team => team.drivers)
                                              .concat(loadedData.reserveAndF2Drivers)
                                              .some(driver => driver.name === finalShortName && driver.name !== oldPlayerShortName);

                        if (isNameTaken) {
                            alert(`3文字表記 "${finalShortName}" は既に使用されています。名前の変更はキャンセルされました。`);
                        } else {
                            // 名前の更新を適用
                            const newFullName = `${newFirstName.trim()} ${newLastName.trim()}`;
                            loadedData.careerPlayerName.firstName = newFirstName.trim();
                            loadedData.careerPlayerName.lastName = newLastName.trim();
                            loadedData.chosenPlayerInfo.fullName = newFullName;
                            loadedData.chosenPlayerInfo.driverName = finalShortName;

                            // driverLineups内の古いプレイヤー名も新しい名前に更新する
                            const playerTeamName = loadedData.careerPlayerTeamName;
                            const playerTeam = loadedData.driverLineups[playerTeamName];
                            if (playerTeam) {
                                const playerInTeam = playerTeam.drivers.find(d => d.name === oldPlayerShortName);
                                if (playerInTeam) {
                                    playerInTeam.name = finalShortName;
                                    playerInTeam.fullName = newFullName;
                                }
                            }
                            alert("プレイヤー名を更新しました。");
                        }
                    }
                }
            }

            const loadResult = applyLoadedData(loadedData);

            if (loadResult.success) {
                // All data is loaded. initializeCars (if needed) has been called
                // within applyLoadedData based on the *saved* state (loadResult.loadedGameState).
                // Now, explicitly transition to the machine performance screen.
                gameState = 'career_machine_performance';
            } else {
                // Load failed, go to title screen as a fallback.
                gameState = 'title_screen';
            }
        }
        return;
    }
    if (gameState === 'driver_selection') {
        if (!careerPlayerTeamName) {
            if (raceMode === 'versus') {
                const viewports = getMultiplayerViewports();
                for (let player = 0; player < viewports.length; player++) {
                    const buttons = getMultiplayerDriverButtons(viewports[player]);
                    const selectedButton = buttons.find(button => pointInRect(mousePos.x, mousePos.y, button));
                    if (!selectedButton) continue;
                    const alreadySelected = multiplayerSelections.some((selection, index) =>
                        index !== player && selection?.driverName === selectedButton.driver.name
                    );
                    if (alreadySelected) return;
                    multiplayerSelections[player] = {
                        driverName: selectedButton.driver.name,
                        fullName: selectedButton.driver.fullName || selectedButton.driver.name,
                        imageName: selectedButton.team.image,
                        teamName: selectedButton.teamName,
                        rating: selectedButton.driver.rating,
                        age: selectedButton.driver.age
                    };
                    if (multiplayerSelections.every(Boolean)) {
                        chosenPlayerInfo = multiplayerSelections[0];
                        chosenPlayer2Info = multiplayerSelections[1] || null;
                        beginSelectedRace();
                    }
                    return;
                }
                return;
            }
            const cards = getQuickRaceSelectionLayout();
            for (const card of cards) {
                for (let driverIndex = 0; driverIndex < card.team.drivers.length; driverIndex++) {
                    const driver = card.team.drivers[driverIndex];
                    const buttonX = card.x + 9;
                    const buttonY = card.y + 125 + driverIndex * 23;
                    const buttonWidth = card.width - 18;
                    if (mousePos.x >= buttonX && mousePos.x <= buttonX + buttonWidth &&
                        mousePos.y >= buttonY && mousePos.y <= buttonY + 20) {
                        const selectedDriverInfo = {
                            driverName: driver.name,
                            fullName: driver.fullName || driver.name,
                            imageName: card.team.image,
                            teamName: card.teamName,
                            rating: driver.rating,
                            age: driver.age
                        };

                        if (raceMode === 'versus' && versusSelectionPlayer === 1) {
                            chosenPlayerInfo = selectedDriverInfo;
                            versusSelectionPlayer = 2;
                            return;
                        }
                        if (raceMode === 'versus') {
                            if (selectedDriverInfo.driverName === chosenPlayerInfo.driverName) return;
                            chosenPlayer2Info = selectedDriverInfo;
                        } else {
                            chosenPlayerInfo = selectedDriverInfo;
                        }
                        beginSelectedRace();
                        return;
                    }
                }
            }
            return;
        }

        // 旧キャリアセーブとの互換性のため、キャリア用の選択処理は残す。

        // 以下は既存のドライバー選択ロジック
        // (キャリアモードボタンがクリックされなかった場合に実行される)

        // キャリアモードでチームが選択されていればそのチームのみ、そうでなければ全チーム
        const teams = careerPlayerTeamName ? [careerPlayerTeamName] : Object.keys(driverLineups);
        const numTeams = teams.length;
        const numColumns = careerPlayerTeamName ? 1 : 4; // キャリアモードでチーム選択済みの場合は1列
        const columnWidth = careerPlayerTeamName ? canvas.width : canvas.width / numColumns; // 1列の場合は全幅
        const horizontalPadding = 20; // 各列内の左右のパディング
        // const driverClickableWidth = columnWidth - horizontalPadding * 2 - 10; // 列幅から計算する場合
        const driverClickableWidth = 200; // 固定のクリック幅 (以前の250から調整)

        let currentIterationTeamIndex = 0; // 全チームを走査するためのインデックス
        let startYForRow = 100; // 描画時の最初の行の開始Y座標 (少し上に調整)

        const itemHeight = 30;  // 描画時の行の高さに合わせる
        const driverTextSize = 20;  // 描画時のフォントサイズ目安
        const teamNameHeight = itemHeight; // チーム名表示行の高さ
        // const machineImageHeight = itemHeight * 1.5; // マシン画像削除のため不要
        // const spaceAfterMachineImage = 10; // マシン画像削除のため不要

        const driverNameIndent = 10; // チーム名からのドライバー名のインデント
        const teamBlockPaddingY = 40; // チームブロックの行間の縦のスペース

        while (currentIterationTeamIndex < numTeams) {
            let maxDriversInThisRow = 0;
            let teamsInCurrentRowData = [];

            // 現在の行に表示されるチームの情報を収集
            for (let col = 0; col < numColumns && (currentIterationTeamIndex + col) < numTeams; col++) { // numTeams を使用
                const teamName = teams[currentIterationTeamIndex + col];
                const teamInfo = driverLineups[teamName];
                teamsInCurrentRowData.push({
                    name: teamName,
                    drivers: teamInfo.drivers,
                    images: teamInfo.images,
                    columnIndexInRow: col
                });
                maxDriversInThisRow = Math.max(maxDriversInThisRow, teamInfo.drivers.length);
            }

            // この行の各チームのドライバーをチェック
            for (const teamData of teamsInCurrentRowData) {
                let teamDisplayX = teamData.columnIndexInRow * columnWidth + horizontalPadding;
                if (careerPlayerTeamName) { // キャリアモードでチーム選択済みの場合、中央に表示
                    // クリック判定のX座標も描画に合わせて調整
                    teamDisplayX = canvas.width / 2 - driverClickableWidth / 2; // 描画要素の幅を考慮して中央寄せ
                }
                // ドライバーリストの開始Y座標は、チーム名の表示後 (マシン画像削除)
                let driverDisplayY = startYForRow + teamNameHeight;

                for (let i = 0; i < teamData.drivers.length; i++) {
                    const driverObj = teamData.drivers[i]; // Get the driver object
                    const driverName = driverObj.name;    // Extract name
                    const driverRating = driverObj.rating;  // Extract rating
                    const driverAge = driverObj.age; // Extract age
                    // const driverImageName = teamData.images[i]; // 不要
                    const driverTextStartX = teamDisplayX + driverNameIndent;

                    const clickTop = driverDisplayY - driverTextSize;
                    const clickBottom = driverDisplayY + 5; // ベースラインより少し下
                    if (mousePos.x >= driverTextStartX && mousePos.x <= driverTextStartX + driverClickableWidth &&
                        mousePos.y >= clickTop && mousePos.y <= clickBottom) {

                        if (careerPlayerTeamName) { // キャリアモードでチーム選択済みの場合
                            // プレイヤー名は既にフォーマット済みで chosenPlayerInfo.driverName に設定されている
                            // chosenPlayerInfo.imageName は既にチーム画像名が設定されている
                            chosenPlayerInfo.teamName = teamData.name; // これは careerPlayerTeamName と同じはず
                            chosenPlayerInfo.rating = driverRating;
                            // chosenPlayerInfo.age はキャリア開始時またはシーズン終了時に設定/更新される
                        } else { // 通常のドライバー選択
                            chosenPlayerInfo = {
                                driverName: driverName, // AIドライバーの整形済み名
                                fullName: driverLineups[teamData.name].drivers.find(d => d.name === driverName)?.fullName || driverName, // AIのフルネーム
                                // imageName: driverImageName, // 不要。チームの画像名を設定
                                imageName: driverLineups[teamData.name].image,
                                teamName: teamData.name,
                                rating: driverRating,
                                age: driverAge // AIドライバーの年齢も設定
                            };
                        }
                        // キャリアモードの場合、careerPlayerTeamName は既に設定されているはず
                        if (careerPlayerTeamName && careerPlayerTeamName !== teamData.name) {
                            console.warn("Mismatch: careerPlayerTeamName and selected driver's teamName differ.");
                        }
                        initializeCars();
                        gameState = 'signal_sequence';
                        signalLightsOnCount = 0;
                        lastSignalChangeTimestamp = Date.now();
                        // SIGNAL_ALL_LIGHTS_ON_DURATION = Math.random() * 1000 + 500; // DEBUG: 固定値を使用するためコメントアウト
                        raceActualStartTime = 0; raceHistory = []; replayFrameIndex = 0;
                        carsFinishedCount = 0; winnerFinishTime = 0;

                        // === シグナルシーケンス用カメラ初期化 ===
                        zoomLevelBeforeSignal = ZOOM_LEVEL; // シグナルシーケンス開始前のズームレベルを保存
                        signalCameraPhase = 'locked_on_player'; // ズームアニメーションをスキップし、プレイヤーにロックオン
                        signalCameraScrollStartTime = Date.now();
                        // === カメラ初期化ここまで ===
                        return;
                    }
                    driverDisplayY += itemHeight; // 次のドライバー（同じチーム内、縦方向）
                }
            }
            // 次の行の開始Y座標を計算
            // マシン画像の高さを除外
            startYForRow += teamNameHeight + (maxDriversInThisRow * itemHeight) + teamBlockPaddingY;
            currentIterationTeamIndex += teamsInCurrentRowData.length; // 処理したチーム数を進める
        }
        return; // ドライバー選択画面で、ドライバー以外をクリックした場合は何もしない
    }

    // Handle Replay Button click first, if visible
    // This button is visible in 'all_finished' state, or
    // in 'replay' state when a replay has just ended (and not in career mode).
    if (replayButton.isVisible && replayButton.isClicked(mousePos.x, mousePos.y)) {
        gameState = 'replay'; // Transition to or confirm replay state
        replayFrameIndex = 0; // リプレイは最初から再生
        selectedReplayCarIndex = playerCarIndex; // デフォルトはプレイヤー追尾
        isReplayPaused = false;
        replaySpeedMultiplier = 1.0;
        lastReplayUpdateTime = Date.now();
        replayButton.isVisible = false; // Hide after clicking to start/restart replay
        careerReplayBackButton.isVisible = false; // Ensure this is also hidden
        careerReplayAgainButton.isVisible = false; // And this one too
        console.log("Replay (re)started via Button");
        return; // Click handled
    }

    // If not a replay button click, then handle other clicks based on gameState
    if (gameState === 'replay') {
        // まず「結果に戻る」ボタンの判定 (キャリアモードリプレイ終了時)
        if (careerReplayBackButton.isClicked(mousePos.x, mousePos.y)) {
            gameState = 'all_finished';
            careerReplayBackButton.isVisible = false;
            careerReplayAgainButton.isVisible = false;
            replayButton.isVisible = true; // 再度リプレイを見られるように
            if (careerPlayerTeamName) {
                careerNextButton.isVisible = true; // キャリアならNEXTボタンも表示
            }
            console.log("Returned to race results from replay.");
            return; // Click handled
        }
        // 次に「もう一度リプレイを見る」ボタンの判定 (キャリアモードリプレイ終了時)
        if (careerReplayAgainButton.isClicked(mousePos.x, mousePos.y)) {
            // Restart replay
            gameState = 'replay';
            replayFrameIndex = 0;
            selectedReplayCarIndex = playerCarIndex; // Default to player
            isReplayPaused = false;
            replaySpeedMultiplier = 1.0;
            lastReplayUpdateTime = Date.now();
            careerReplayBackButton.isVisible = false;
            careerReplayAgainButton.isVisible = false;
            replayButton.isVisible = false; // Main replay button should also be hidden
            console.log("Replay restarted (career mode, from replay screen).");
            return; // Click handled
        }

        // リプレイUIのドライバー選択リストのクリック判定 (「結果に戻る」が押されなかった場合)
        const replayUiDriverListYStart = 50;
        const replayUiDriverListLineHeight = 20;
        const replayUiDriverListXStart = 10;
        const replayUiDriverListWidth = 200; // クリック判定の幅
        const sortedCarsForClickHandling = cars.map((car, index) => ({ ...car, originalIndex: index })).sort((a, b) => a.y - b.y);

        sortedCarsForClickHandling.forEach((carData, sortedIndex) => {
            const driverNameY = replayUiDriverListYStart + sortedIndex * replayUiDriverListLineHeight;
            if (mousePos.x >= replayUiDriverListXStart && mousePos.x <= replayUiDriverListXStart + replayUiDriverListWidth &&
                mousePos.y >= driverNameY - replayUiDriverListLineHeight / 2 && mousePos.y <= driverNameY + replayUiDriverListLineHeight / 2) {
                selectedReplayCarIndex = carData.originalIndex;
            }
        });
        // 他のリプレイ中UI要素のクリック判定はここに追加
    } else if (gameState !== 'all_finished') { // 'all_finished' 以外の状態で、まだリプレイボタンが押されていない場合
        // No specific actions needed here for now, but this structure allows future expansion.
    }
});

// セーブ/ロード画面でクリックされたスロットのインデックスを取得するヘルパー
function getClickedSlotIndex(mouseX, mouseY) {
    if (calculatedSlotWidth <= 0) return -1; // スロット幅が未計算なら何もしない

    for (let i = 0; i < MAX_SAVE_SLOTS; i++) {
        const col = i % SLOTS_PER_ROW;
        const row = Math.floor(i / SLOTS_PER_ROW);

        const slotX = SLOT_MARGIN_X + col * (calculatedSlotWidth + SLOT_MARGIN_X);
        const slotY = SLOT_START_Y_OFFSET + row * (calculatedSlotHeight + SLOT_MARGIN_Y);

        if (mouseX >= slotX && mouseX <= slotX + calculatedSlotWidth &&
            mouseY >= slotY && mouseY <= slotY + calculatedSlotHeight) {
            return i;
        }
    }
    return -1;
}

// マウス位置をグローバルに追跡 (スロットのハイライト用)
let currentMouseX = 0;
let currentMouseY = 0;
canvas.addEventListener('mousemove', (event) => {
    const mousePos = getMousePos(canvas, event);
    currentMouseX = mousePos.x;
    currentMouseY = mousePos.y;

    let isInteractive = gameState === 'title_screen' &&
        (quickRaceButton.isClicked(mousePos.x, mousePos.y) || twoPlayerRaceButton.isClicked(mousePos.x, mousePos.y) ||
            drsSettingButton.isClicked(mousePos.x, mousePos.y) || courseSettingButton.isClicked(mousePos.x, mousePos.y) ||
            aiModeSettingButton.isClicked(mousePos.x, mousePos.y));
    if (gameState === 'multiplayer_setup') {
        isInteractive = pointInRect(mousePos.x, mousePos.y, multiplayerSetupButtons.back) ||
            pointInRect(mousePos.x, mousePos.y, multiplayerSetupButtons.cpu) ||
            pointInRect(mousePos.x, mousePos.y, multiplayerSetupButtons.aiMode) ||
            pointInRect(mousePos.x, mousePos.y, multiplayerSetupButtons.start) ||
            multiplayerSetupButtons.playerCounts.some(button => pointInRect(mousePos.x, mousePos.y, button));
    }
    if (gameState === 'driver_selection' && !careerPlayerTeamName) {
        if (raceMode === 'versus') {
            isInteractive = getMultiplayerViewports().some(viewport =>
                getMultiplayerDriverButtons(viewport).some(button => pointInRect(mousePos.x, mousePos.y, button))
            );
        } else {
            isInteractive = getQuickRaceSelectionLayout().some(card =>
                card.team.drivers.some((driver, driverIndex) => {
                    const buttonY = card.y + 125 + driverIndex * 23;
                    return mousePos.x >= card.x + 9 && mousePos.x <= card.x + card.width - 9 &&
                        mousePos.y >= buttonY && mousePos.y <= buttonY + 20;
                })
            );
        }
    }
    canvas.style.cursor = isInteractive ? 'pointer' : 'default';

    if (isDraggingZoomSlider) { // 既存のロジック
        updateZoomLevelFromMouse(mousePos.y);
    }
});
function updateZoomLevelFromMouse(mouseY) {
    let newZoom = MIN_ZOOM + ((mouseY - sliderTrackY) / SLIDER_TRACK_HEIGHT) * (MAX_ZOOM - MIN_ZOOM);
    ZOOM_LEVEL = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
}
// 車体角に合わせた四隅のワールド座標を取得する。
function getRotatedCarCorners(car) {
    const centerX = car.x + CAR_WIDTH / 2;
    const centerY = car.y + CAR_HEIGHT / 2;
    const halfW = CAR_WIDTH / 2;
    const halfH = CAR_HEIGHT / 2;
    const angle = car.angle;

    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    // 車の中心を原点としたときの四隅のローカル座標
    const localCorners = [
        { x: -halfW, y: -halfH }, // 左上
        { x:  halfW, y: -halfH }, // 右上
        { x:  halfW, y:  halfH }, // 右下
        { x: -halfW, y:  halfH }  // 左下
    ];

    return localCorners.map(p => ({
        x: centerX + p.x * cosA - p.y * sinA,
        y: centerY + p.x * sinA + p.y * cosA
    }));
}

// 壁判定と高速な事前判定に使う回転外接矩形。
function getRotatedAABB(car) {
    const corners = getRotatedCarCorners(car);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    corners.forEach(p => {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
    });
    return { minX, maxX, minY, maxY };
}

function projectCornersOntoAxis(corners, axis) {
    let min = Infinity;
    let max = -Infinity;
    corners.forEach(point => {
        const projection = point.x * axis.x + point.y * axis.y;
        min = Math.min(min, projection);
        max = Math.max(max, projection);
    });
    return { min, max };
}

// 分離軸判定で、傾いた車体同士を実際の向きのまま判定する。
function rotatedCarsOverlap(carA, carB) {
    const cornersA = getRotatedCarCorners(carA);
    const cornersB = getRotatedCarCorners(carB);
    const axes = [];

    [cornersA, cornersB].forEach(corners => {
        for (let i = 0; i < 2; i++) {
            const next = (i + 1) % corners.length;
            const edgeX = corners[next].x - corners[i].x;
            const edgeY = corners[next].y - corners[i].y;
            const length = Math.hypot(edgeX, edgeY) || 1;
            axes.push({ x: -edgeY / length, y: edgeX / length });
        }
    });

    return axes.every(axis => {
        const projectionA = projectCornersOntoAxis(cornersA, axis);
        const projectionB = projectCornersOntoAxis(cornersB, axis);
        return projectionA.max > projectionB.min && projectionB.max > projectionA.min;
    });
}

function getRearWheelPositions(car) {
    const centerX = car.x + CAR_WIDTH / 2;
    const centerY = car.y + CAR_HEIGHT / 2;
    const rearOffset = -CAR_WIDTH * 0.32;
    const wheelOffset = CAR_HEIGHT * 0.31;
    const cosA = Math.cos(car.angle);
    const sinA = Math.sin(car.angle);
    const toWorld = localY => ({
        x: centerX + rearOffset * cosA - localY * sinA,
        y: centerY + rearOffset * sinA + localY * cosA
    });
    return { left: toWorld(-wheelOffset), right: toWorld(wheelOffset) };
}

function recordTireMarks(car) {
    if (!car.tireMarks) car.tireMarks = [];
    const wheels = getRearWheelPositions(car);
    const isCornering = car.isCorneringForTireMarks || Math.abs(car.lateralVelocity || 0) > 0.35;
    if (!isCornering) {
        // 直進区間では痕を描かず、次のカーブ開始時に長い線がつながるのも防ぐ。
        car.lastTireMarkWheels = null;
        return;
    }

    const previous = car.lastTireMarkWheels;
    if (!previous) {
        car.lastTireMarkWheels = wheels;
        return;
    }

    const distance = Math.hypot(wheels.left.x - previous.left.x, wheels.left.y - previous.left.y);
    if (distance < TIRE_MARK_MIN_DISTANCE) return;

    // 大きな座標ジャンプでは線をつながず、その地点から記録を再開する。
    if (distance <= 70) {
        car.tireMarks.push({
            leftStart: previous.left,
            leftEnd: wheels.left,
            rightStart: previous.right,
            rightEnd: wheels.right
        });
        if (car.tireMarks.length > TIRE_MARK_MAX_SEGMENTS_PER_CAR) car.tireMarks.shift();
    }
    car.lastTireMarkWheels = wheels;
}

function drawTireMarks(visibleTop, visibleBottom) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    cars.forEach(car => {
        const marks = car.tireMarks || [];
        // 軌跡は進行方向順に保存されるため、新しい側から可視範囲だけを描く。
        for (let i = marks.length - 1; i >= 0; i--) {
            const mark = marks[i];
            const minY = Math.min(mark.leftStart.y, mark.leftEnd.y, mark.rightStart.y, mark.rightEnd.y);
            const maxY = Math.max(mark.leftStart.y, mark.leftEnd.y, mark.rightStart.y, mark.rightEnd.y);
            if (minY > visibleBottom + 10) break;
            if (maxY < visibleTop - 10) continue;
            ctx.moveTo(mark.leftStart.x, mark.leftStart.y);
            ctx.lineTo(mark.leftEnd.x, mark.leftEnd.y);
            ctx.moveTo(mark.rightStart.x, mark.rightStart.y);
            ctx.lineTo(mark.rightEnd.x, mark.rightEnd.y);
        }
    });
    ctx.stroke();
    ctx.restore();
}
// ====== ゲームロジック ======

// ====== Joystick/Gamepad Support ======
let gamepads = {};
let activeGamepadId = null;
const JOYSTICK_DEADZONE = 0.15; // スティックのデッドゾーン
const JOYSTICK_AXIS_THRESHOLD_ACCEL_BRAKE = 0.05; // トリガーやスティックの加速/ブレーキ検知閾値

window.addEventListener('gamepadconnected', (event) => {
    console.log('Gamepad connected:', event.gamepad);
    gamepads[event.gamepad.index] = event.gamepad;
    if (activeGamepadId === null) {
        activeGamepadId = event.gamepad.index;
        console.log('Active gamepad set to:', activeGamepadId);
        // alert(`Gamepad "${event.gamepad.id}" connected and active!`);
    }
});

window.addEventListener('gamepaddisconnected', (event) => {
    console.log('Gamepad disconnected:', event.gamepad);
    delete gamepads[event.gamepad.index];
    if (activeGamepadId === event.gamepad.index) {
        activeGamepadId = null;
        console.log('Active gamepad disconnected. Searching for another one...');
        const connectedIds = Object.keys(gamepads);
        if (connectedIds.length > 0) {
            activeGamepadId = parseInt(connectedIds[0]);
            console.log('New active gamepad set to:', activeGamepadId);
            // alert(`Active gamepad changed to: "${gamepads[activeGamepadId].id}"`);
        } else {
            console.log('No other gamepads connected.');
            // alert("Active gamepad disconnected. No other gamepads available.");
        }
    }
});

function applyDeadzone(value, threshold) {
    return Math.abs(value) < threshold ? 0 : value;
}

/**
 * Handles gamepad input for the player's car.
 * @param {object} playerCar The player's car object.
 * @returns {object} An object indicating which controls were handled by the gamepad: { steered: boolean, moved: boolean }.
 */
function handleGamepadInput(playerCar) {
    const controlState = {
        steered: false,
        moved: false // Indicates if acceleration or braking was handled
    };

    if (activeGamepadId === null || !gamepads[activeGamepadId]) {
        return controlState;
    }

    // Always get the latest state of the gamepad
    const gamepad = navigator.getGamepads()[activeGamepadId];
    if (!gamepad) {
        // Gamepad might have been disconnected without the event firing immediately
        // or navigator.getGamepads() hasn't updated yet.
        return controlState;
    }

    // Steering (Left Stick X-axis: typically gamepad.axes[0])
    const steerAxis = applyDeadzone(gamepad.axes[0], JOYSTICK_DEADZONE);
    if (steerAxis !== 0) {
        const steeringFactor = playerCar.maxSpeed > 0 ? Math.abs(playerCar.speed) / playerCar.maxSpeed : 0;
        const currentTurnSpeed = playerCar.turnSpeed * steeringFactor / 5 * 2 / 3;
        const turnDirection = playerCar.speed >= 0 ? 1 : -1;
        playerCar.angle += currentTurnSpeed * steerAxis * turnDirection;
        controlState.steered = true;
    }

    // Acceleration and Braking
    let accelerateInput = 0;
    let brakeInput = 0;

    // Standard Gamepad API: buttons[7] is R2/RT (accelerate), buttons[6] is L2/LT (brake)
    if (gamepad.buttons[7] && gamepad.buttons[7].value > JOYSTICK_AXIS_THRESHOLD_ACCEL_BRAKE) {
        accelerateInput = gamepad.buttons[7].value; // value is 0.0 to 1.0
    }
    if (gamepad.buttons[6] && gamepad.buttons[6].value > JOYSTICK_AXIS_THRESHOLD_ACCEL_BRAKE) {
        brakeInput = gamepad.buttons[6].value; // value is 0.0 to 1.0
    }

    // Fallback: Left Stick Y-axis (typically gamepad.axes[1]) if triggers were not significantly pressed
    if (accelerateInput < JOYSTICK_AXIS_THRESHOLD_ACCEL_BRAKE && brakeInput < JOYSTICK_AXIS_THRESHOLD_ACCEL_BRAKE) {
        const accelBrakeAxis = applyDeadzone(gamepad.axes[1], JOYSTICK_DEADZONE); // Negative is usually up (accelerate)
        if (accelBrakeAxis < -JOYSTICK_AXIS_THRESHOLD_ACCEL_BRAKE) { // Stick pushed up
            accelerateInput = -accelBrakeAxis; // Make it positive
        } else if (accelBrakeAxis > JOYSTICK_AXIS_THRESHOLD_ACCEL_BRAKE) { // Stick pushed down
            brakeInput = accelBrakeAxis;
        }
    }

    if (accelerateInput > 0 || brakeInput > 0) {
        controlState.moved = true;
        const effectiveMaxSpeed = playerCar.speed >= 0 ? playerCar.maxSpeed : playerCar.maxSpeedReverse;
        const speedFactor = effectiveMaxSpeed > 0 ? Math.abs(playerCar.speed) / effectiveMaxSpeed : 0;
        const currentAcceleration = playerCar.acceleration * getCurrentAccelerationFactor(playerCar) * (1 - speedFactor);

        if (accelerateInput > 0) {
            playerCar.speed = Math.min(playerCar.speed + currentAcceleration * accelerateInput, playerCar.maxSpeed);
        }
        // If both accelerate and brake are active (e.g. from stick and trigger), brake might take precedence or sum.
        // Current logic: if accelerateInput > 0, it accelerates. Then, if brakeInput > 0, it brakes.
        // This means braking can override or reduce the acceleration effect from the same input pass.
        if (brakeInput > 0) {
            playerCar.speed = Math.max(playerCar.speed - playerCar.braking * brakeInput, -playerCar.maxSpeedReverse);
        }
    }

    return controlState;
}

function handleSignalSequence() {
    // 詳細なガード節: cars 配列や playerCarIndex の状態をチェック
    if (!cars) {
        const errorMsg = "handleSignalSequence: cars array is null or undefined. Transitioning to title screen.";
        console.error(errorMsg);
        alert(errorMsg); // 追加
        gameState = 'title_screen';
        return;
    }
    if (cars.length === 0) {
        const errorMsg = "handleSignalSequence: cars array is empty. Transitioning to title screen.";
        console.error(errorMsg);
        alert(errorMsg); // 追加
        gameState = 'title_screen';
        return;
    }
    if (playerCarIndex < 0 || playerCarIndex >= cars.length) {
        const errorMsg = `handleSignalSequence: playerCarIndex (${playerCarIndex}) is out of bounds for cars array (length ${cars.length}). Transitioning to title screen.`;
        console.error(errorMsg);
        alert(errorMsg); // 追加
        gameState = 'title_screen';
        return;
    }
    if (!cars[playerCarIndex]) {
        const errorMsg = `handleSignalSequence: cars[playerCarIndex] (cars[${playerCarIndex}]) is undefined. Transitioning to title screen.`;
        console.error(errorMsg);
        alert(errorMsg); // 追加
        gameState = 'title_screen';
        return;
    }
    if (!cars[0]) { // 先頭車両のチェックも重要 (カメラのスクロールロジックで使用)
        const errorMsg = "handleSignalSequence: cars[0] is undefined. Transitioning to title screen.";
        console.error(errorMsg);
        alert(errorMsg); // 追加
        gameState = 'title_screen';
        return;
    }

    const currentTime = Date.now();

    // --- シグナルシーケンス中のカメラ制御 ---
    let targetOffsetX, targetOffsetY;
    const lerpFactor = 0.08; // スムーズ化係数

    if (signalCameraPhase === 'focus_leader') {
        // このフェーズは新しいロジックでは使用されないが、念のため残す場合は
        signalCameraPhase = 'locked_on_player'; // 古いフェーズからの移行

        let actualGridCenterY;
        if (cars && cars.length > 0 && cars[0] && cars[Math.min(NUM_CARS - 1, cars.length - 1)]) {
            const firstCarY = cars[0].y;
            const lastCarInGrid = cars[Math.min(NUM_CARS - 1, cars.length - 1)];
            actualGridCenterY = firstCarY + ((lastCarInGrid.y - firstCarY) / 2);
        } else {
            actualGridCenterY = initialGridY + ((GRID_ROWS - 1) * ROW_SPACING) / 2; // Fallback
        }
        targetOffsetX = (canvas.width / 2) - (canvas.width / 2 / ZOOM_LEVEL);
        targetOffsetY = actualGridCenterY - (canvas.height / 2 / ZOOM_LEVEL);

    } else if (signalCameraPhase === 'show_full_grid') {
        ZOOM_LEVEL = initialSignalZoom;
        targetOffsetX = 0; // X座標は常に0

        cameraOffsetX += (targetOffsetX - cameraOffsetX) * lerpFactor;
        // cameraOffsetY += (targetOffsetY - cameraOffsetY) * lerpFactor; // Yは別途計算される

        if (currentTime - signalCameraScrollStartTime > SIGNAL_CAMERA_GRID_VIEW_DURATION) {
            signalCameraPhase = 'zoom_to_player';
            signalCameraScrollStartTime = currentTime;
        }
    } else if (signalCameraPhase === 'zoom_to_player') {
        const playerCar = cars[playerCarIndex];
        if (!playerCar) {
            console.error("Player car not found during signal sequence zoom_to_player phase.");
            signalCameraPhase = 'locked_on_player';
            return;
        }

        const totalSignalLightDuration = (SIGNAL_NUM_LIGHTS * SIGNAL_LIGHT_ON_INTERVAL) + SIGNAL_ALL_LIGHTS_ON_DURATION;
        const zoomPhaseDuration = totalSignalLightDuration - SIGNAL_CAMERA_GRID_VIEW_DURATION;

        if (zoomPhaseDuration <= 0) {
            signalCameraPhase = 'locked_on_player';
            ZOOM_LEVEL = zoomLevelBeforeSignal;
            return;
        }

        const timeInZoomPhase = currentTime - signalCameraScrollStartTime;
        let progress = Math.min(1.0, timeInZoomPhase / zoomPhaseDuration);
        progress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2; // EaseInOutQuad

        ZOOM_LEVEL = initialSignalZoom + (zoomLevelBeforeSignal - initialSignalZoom) * progress;
        ZOOM_LEVEL = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, ZOOM_LEVEL));

        const startZoomForOffsetCalc = initialSignalZoom;
        let actualGridCenterY;
        if (cars && cars.length > 0 && cars[0] && cars[Math.min(NUM_CARS - 1, cars.length - 1)]) {
            const firstCarY = cars[0].y;
            const lastCarInGrid = cars[Math.min(NUM_CARS - 1, cars.length - 1)];
            actualGridCenterY = firstCarY + ((lastCarInGrid.y - firstCarY) / 2);
        } else {
            actualGridCenterY = initialGridY + ((GRID_ROWS - 1) * ROW_SPACING) / 2;
        }

        const initialTargetOffsetX = (canvas.width / 2) - (canvas.width / 2 / startZoomForOffsetCalc);
        const initialTargetOffsetY = actualGridCenterY - (canvas.height / 2 / startZoomForOffsetCalc);
        const finalTargetOffsetX = (canvas.width / 2) - (canvas.width / 2 / zoomLevelBeforeSignal);
        const finalTargetOffsetY = playerCar.y + (CAR_HEIGHT / 2) - (canvas.height * PLAYER_CAMERA_Y_POSITION_RATIO / zoomLevelBeforeSignal);

        targetOffsetX = initialTargetOffsetX + (finalTargetOffsetX - initialTargetOffsetX) * progress;
        targetOffsetY = initialTargetOffsetY + (finalTargetOffsetY - initialTargetOffsetY) * progress;

        cameraOffsetX += (targetOffsetX - cameraOffsetX) * lerpFactor;
        cameraOffsetY += (targetOffsetY - cameraOffsetY) * lerpFactor;

        if (progress >= 1.0) {
            signalCameraPhase = 'locked_on_player';
            ZOOM_LEVEL = zoomLevelBeforeSignal;
        }

    } else if (signalCameraPhase === 'locked_on_player') {
        const playerCar = cars[playerCarIndex];
         if (!playerCar) {
            targetOffsetX = (canvas.width / 2) - (canvas.width / 2 / ZOOM_LEVEL);
            if (cars && cars.length > 0 && cars[0]) { // Yは引き続き計算
                targetOffsetY = cars[0].y + (CAR_HEIGHT / 2) - (canvas.height * PLAYER_CAMERA_Y_POSITION_RATIO / ZOOM_LEVEL);
            } else {
                targetOffsetY = cameraOffsetY;
            }
        } else {
            targetOffsetX = (canvas.width / 2) - (canvas.width / 2 / ZOOM_LEVEL);
            targetOffsetY = playerCar.y + (CAR_HEIGHT / 2) - (canvas.height * PLAYER_CAMERA_Y_POSITION_RATIO / ZOOM_LEVEL);
        }
        cameraOffsetX += (targetOffsetX - cameraOffsetX) * lerpFactor;
        cameraOffsetY += (targetOffsetY - cameraOffsetY) * lerpFactor;
    } else { // 'idle' または予期せぬ状態
        const fallbackTarget = cars[playerCarIndex] || (cars && cars.length > 0 ? cars[0] : null);
        if (fallbackTarget) {             cameraOffsetX = (canvas.width / 2) - (canvas.width / 2 / ZOOM_LEVEL);
             cameraOffsetY = fallbackTarget.y + (CAR_HEIGHT / 2) - (canvas.height * PLAYER_CAMERA_Y_POSITION_RATIO / ZOOM_LEVEL);
        }
    }
    // --- カメラ制御ここまで ---

    if (signalLightsOnCount < SIGNAL_NUM_LIGHTS) { // まだ全てのライトが点灯していない場合
        if (currentTime - lastSignalChangeTimestamp > SIGNAL_LIGHT_ON_INTERVAL) {
            signalLightsOnCount++;
            lastSignalChangeTimestamp = currentTime;
        }
    } else if (signalLightsOnCount === SIGNAL_NUM_LIGHTS) { // 全てのライトが点灯している場合
        // この状態は SIGNAL_ALL_LIGHTS_ON_DURATION の間維持される
        if (currentTime - lastSignalChangeTimestamp > SIGNAL_ALL_LIGHTS_ON_DURATION) {
            gameState = 'race'; // レース開始！
            signalLightsOnCount = -1; // 消灯状態を示す（描画用）

            const raceStartTime = Date.now(); // この時刻を raceActualStartTime にも使う
            raceActualStartTime = raceStartTime;
            cars.forEach(car => {
                car.gameStartTime = raceStartTime; // AIのスタート遅延計算の基準時刻
                car.timingCheckpointTimes = { 0: raceStartTime };
                car.lastTimingCheckpointIndex = 0;
            });
            // ZOOM_LEVEL = zoomLevelBeforeSignal; // レース開始時のズームレベル変更をキャンセル
            signalCameraPhase = 'idle'; // カメラフェーズをリセット
        }
    }
}

function update() {
    // 全ての画像がロードされていない場合は、更新処理を行わない
    if (!allImagesLoaded) {
        return;
    }

    // レース中の現在時刻を取得 (スリップストリーム検知などで使用するため、関数の早い段階で定義)
    const currentTime = Date.now();

    // === タイトル画面のカメラ制御 ===
    if (gameState === 'title_screen') {
        titleScreenCameraOffsetY += TITLE_SCREEN_SCROLL_SPEED;
        // cameraOffsetX は drawTitleScreen 内で固定値で設定される想定
        // ZOOM_LEVEL も drawTitleScreen 内で固定値で設定される想定
        // タイトル画面では他の更新処理は不要なため、ここでreturnしても良いが、
        // gameLoopの構造上、drawが呼ばれるので、ここではreturnしない。
    }

    if (gameState === 'signal_sequence') {
        handleSignalSequence();
        // シグナルシーケンス中は車の動きを止める
        cars.forEach(car => {
            car.speed = 0;
        });
        // シグナル中はキー入力によるカメラ操作やプレイヤー追従を無効化するため、
        // update内の通常のカメラロジックはスキップ。
        // cameraOffsetX と cameraOffsetY は handleSignalSequence で設定される。
        return; // レースロジックは実行しない
    }

    // === スリップストリームの検知 (レース中のみ) ===
    if (gameState === 'race') {
        for (let i = 0; i < cars.length; i++) {
            const follower = cars[i];
            // 速度が足りなければチェックしない
            if (follower.speed < SLIPSTREAM_MIN_SPEED_THRESHOLD) {
                continue;
            }

            for (let j = 0; j < cars.length; j++) {
                if (i === j) continue;
                const leader = cars[j];
                const yDiff = follower.y - leader.y; // followerがleaderの後ろにいるか (正の値)
                const xDiff = Math.abs(follower.x - leader.x);

                if (yDiff > 0 && yDiff < SLIPSTREAM_DETECTION_DISTANCE_Y && xDiff < SLIPSTREAM_DETECTION_WIDTH_X) {
                    follower.isInSlipstream = true;
                    follower.slipstreamEndTime = currentTime + SLIPSTREAM_DURATION;
                    // 新たにスリップストリームに入った場合、減衰プロセスを停止
                    follower.slipstreamDecayStartTime = 0;
                    break; // 1台見つけたら十分
                }
            }
        }
    }

    // === リプレイ状態の更新 ===
    if (gameState === 'replay') {
        handleReplayUpdate();
        // リプレイ中は物理演算やAIはスキップ
        return;
    }


    if (gameState === 'finished') {
        // レース終了後の処理 (例: プレイヤー入力無効化、AI停止など)
        // 今回は描画でメッセージを出す程度にし、updateは継続するが車の動きは止めるなど検討
        cars.forEach(car => { if (car.hasFinished && car.speed > 0) car.speed = Math.max(0, car.speed - car.friction * 5);}); // ゴール後は減速
    } else if (gameState === 'all_finished') {
        // 全車ゴール後、リプレイ待ち状態
        // replayButton.isVisible は 'all_finished' への遷移時に設定されるため、ここでは必須ではない
        // ただし、状態が直接 'all_finished' で始まる稀なケースを考慮するなら残しても良い
        // 必要であれば車の動きを完全に止める
    }

    // ゴールまでの距離(km)を計算 (レース中のみ)
    if (gameState === 'race') {
        const playerCarY = cars[playerCarIndex].y;
        const rawDistancePixels = playerCarY - GOAL_LINE_Y_POSITION;
        if (rawDistancePixels > 0) {
            // (pixels * (km/h / (px/frame))) / (frames/sec * sec/h) = km
            distanceToGoal = rawDistancePixels * SPEED_TO_KMH_FACTOR / (ASSUMED_FPS * SECONDS_PER_HOUR);
            distanceToGoal = Math.max(0, distanceToGoal); // Ensure non-negative
        } else {
            distanceToGoal = 0; // At or past goal line
        }
    } else if (gameState === 'finished' || gameState === 'all_finished') {
        distanceToGoal = 0; // ゴール後は0km
    } else {
        distanceToGoal = null; // レース中、終了状態以外は計算しない
    }


    let carsSpeedReducedThisFrame = new Set(); // このフレームで速度が減少した車を記録

    // 1. 各車の状態更新（順位決定、DRS判定、maxSpeed計算）
    //    車のy座標が小さいほど上位とする
    const rankedCarsDataForSpeedCalc = cars
        .map((car, index) => ({
            y: car.y,
            originalIndex: index,
            gridAdjustedMaxSpeed: car.gridAdjustedMaxSpeed // 計算に必要なので渡す
        }))
        .sort((a, b) => a.y - b.y); // y座標で昇順ソート (小さい方が上位)

    rankedCarsDataForSpeedCalc.forEach((rankedCarEntry, sortedIndex) => {
        const actualCar = cars[rankedCarEntry.originalIndex];
        const currentRank = sortedIndex + 1; // 1位からNUM_CARS位

        if (!drsEnabled) {
            actualCar.isDrsActive = false;
        } else {
            const passedPointIndex = Math.floor(Math.max(0, -actualCar.y) / DRS_POINT_SPACING_PX);
            if (passedPointIndex > actualCar.lastDrsPointIndex) {
                actualCar.lastDrsPointIndex = passedPointIndex;
                const carAheadEntry = sortedIndex > 0 ? rankedCarsDataForSpeedCalc[sortedIndex - 1] : null;
                if (carAheadEntry) {
                    const carAhead = cars[carAheadEntry.originalIndex];
                    const distanceGap = Math.max(0, actualCar.y - carAhead.y);
                    const referenceSpeed = Math.max(0.1, Math.abs(actualCar.speed));
                    const gapSeconds = distanceGap / referenceSpeed / ASSUMED_FPS;
                    actualCar.isDrsActive = gapSeconds <= DRS_MAX_GAP_SECONDS;
                    actualCar.drsActiveUntilY = -(passedPointIndex + 1) * DRS_POINT_SPACING_PX;
                } else {
                    actualCar.isDrsActive = false;
                    actualCar.drsActiveUntilY = null;
                }
            }
            if (actualCar.isDrsActive && actualCar.drsActiveUntilY !== null && actualCar.y <= actualCar.drsActiveUntilY) {
                actualCar.isDrsActive = false;
            }
        }

        // プレイヤーの順位を特定
        if (rankedCarEntry.originalIndex === playerCarIndex) {
            currentPlayerRank = currentRank;
        }

        // 1位とのランク差 (0なら1位)
        const rankDifferenceFromLeader = currentRank - 1;

        // ランク差に基づくキャッチアップ係数を計算
        const dynamicCatchUpFactor = 1 + (rankDifferenceFromLeader * CATCH_UP_SPEED_FACTOR_PER_RANK); // この行は変更しません

        // スリップストリーム効果の終了判定と係数設定
        let slipstreamFactor = 1.0;
        if (actualCar.isInSlipstream) {
            // スリップストリーム効果が切れたら、減衰プロセスを開始
            if (currentTime > actualCar.slipstreamEndTime) {
                actualCar.isInSlipstream = false;
                // 減衰がまだ開始されていなければ、現在の時刻を記録
                if (actualCar.slipstreamDecayStartTime === 0) {
                    actualCar.slipstreamDecayStartTime = currentTime;
                }
            } else {
                slipstreamFactor = SLIPSTREAM_BOOST_FACTOR;
                actualCar.slipstreamDecayStartTime = 0; // スリップストリーム効果中は減衰タイマーをリセット
            }
        }
        // スリップストリーム状態ではないが、減衰プロセスが進行中の場合
        if (!actualCar.isInSlipstream && actualCar.slipstreamDecayStartTime > 0) {
            const elapsedTime = currentTime - actualCar.slipstreamDecayStartTime;
            if (elapsedTime < SLIPSTREAM_DECAY_DURATION) { // 5秒未満の場合
                const decayProgress = elapsedTime / SLIPSTREAM_DECAY_DURATION;
                slipstreamFactor = SLIPSTREAM_BOOST_FACTOR - (SLIPSTREAM_BOOST_FACTOR - 1.0) * decayProgress;
            } else {
                actualCar.slipstreamDecayStartTime = 0; // リセット
                slipstreamFactor = 1.0;
            }
        }
        // 基準最高速度にスリップストリームとDRSの係数を適用
        const drsFactor = actualCar.isDrsActive ? DRS_MAX_SPEED_BOOST : 1.0;
        actualCar.maxSpeed = actualCar.gridAdjustedMaxSpeed * dynamicCatchUpFactor * slipstreamFactor * drsFactor;

        // // 現在の順位を previousRank として記録 (次のフレームの変動表示用)
        // // ただし、ゲーム開始直後などで previousRank がまだ設定されていない場合を考慮
        // if (gameState === 'race') { // レース中のみ更新
        //     actualCar.previousRank = currentRank;
        // }
    });

    // パス1: 全ての車のプレイヤー入力/AIロジックを実行 (速度と角度を決定)
    // Note: This pass now also handles smooth rotation after collision
    for (let i = 0; i < cars.length; i++) {
        const car = cars[i];
        const index = i;
        car.isCorneringForTireMarks = false;

        // --- Collision Recovery Rotation ---
        // If the car is recovering from a collision, smoothly rotate towards the target angle
        if (car.isRotatingFromCollision && car.collisionTargetAngle !== null) {
            let angleDiff = car.collisionTargetAngle - car.angle;
            // Normalize the angle difference to be within (-PI, PI]
            angleDiff = (angleDiff + Math.PI) % (2 * Math.PI) - Math.PI;
            if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

            const angleThreshold = 0.05; // Threshold to stop smooth rotation (radians)

            if (Math.abs(angleDiff) > angleThreshold) {
                 // Rotate towards the target angle using the defined speed factor
                 const rotationStep = angleDiff * car.collisionRotationSpeed;
                 car.angle += rotationStep;

                // AIカーの場合、壁からの復帰回転中にわずかに加速して復帰を早める
                if (!playerCarIndices.includes(index)) { // AIカーであるか確認
                    // 最高速度の一定割合 (例: 30%) 未満であれば、ゆっくり加速
                    if (car.speed < car.maxSpeed * 0.3) {
                        car.speed += car.acceleration * 0.1; // 通常の加速度の10%で加速
                    }
                }
            } else {
                car.angle = car.collisionTargetAngle; // Snap to the target angle when close enough
                car.isRotatingFromCollision = false;
                car.collisionTargetAngle = null;
            }
            // Skip normal steering/AI logic if rotating from collision
            if (car.isRotatingFromCollision) { // まだ回転中の場合 (isRotatingFromCollisionがtrueのままなら)
                continue; // 通常のAIロジックをスキップして次の車へ
            }
        }
        // --- End Collision Recovery Rotation ---

        const localPlayerIndex = playerCarIndices.indexOf(index);
        if (localPlayerIndex !== -1) {
            const playerCar = car; // 'car' を playerCar として扱う
            const singlePlayer = raceMode !== 'versus';
            const controlSets = [
                { accelerate: keys.w || (singlePlayer && keys.ArrowUp), brake: keys.s || (singlePlayer && keys.ArrowDown), left: keys.a || (singlePlayer && keys.ArrowLeft), right: keys.d || (singlePlayer && keys.ArrowRight) },
                { accelerate: keys.ArrowUp, brake: keys.ArrowDown, left: keys.ArrowLeft, right: keys.ArrowRight },
                { accelerate: keys.i, brake: keys.k, left: keys.j, right: keys.l },
                { accelerate: keys.Numpad8, brake: keys.Numpad5, left: keys.Numpad4, right: keys.Numpad6 }
            ];
            const controls = controlSets[localPlayerIndex] || controlSets[0];
            const acceleratePressed = controls.accelerate;
            const brakePressed = controls.brake;
            const leftPressed = controls.left;
            const rightPressed = controls.right;
            playerCar.isCorneringForTireMarks = (leftPressed || rightPressed) && Math.abs(playerCar.speed) > 0.5;

            const joystickStatus = localPlayerIndex === 0 ? handleGamepadInput(playerCar) : { moved: false, steered: false };

            let keyboardWantsToMove = acceleratePressed || brakePressed;

            // キーボードによる加速・減速 (ジョイスティックが移動を制御していない場合のみ)
            if (!joystickStatus.moved) {
                const effectiveMaxSpeed = playerCar.speed >= 0 ? playerCar.maxSpeed : playerCar.maxSpeedReverse;
                const speedFactor = effectiveMaxSpeed > 0 ? Math.abs(playerCar.speed) / effectiveMaxSpeed : 0;
                const currentAcceleration = playerCar.acceleration * getCurrentAccelerationFactor(playerCar) * (1 - speedFactor);

                if (acceleratePressed) {
                    playerCar.speed = Math.min(playerCar.speed + currentAcceleration, playerCar.maxSpeed);
                } else if (brakePressed) {
                    playerCar.speed = Math.max(playerCar.speed - playerCar.braking, -playerCar.maxSpeedReverse);
                }
                // 摩擦は後段で、両方の入力がない場合に適用
            }

            // キーボードによるステアリング (ジョイスティックがステアリングを制御していない場合のみ)
            if (!joystickStatus.steered) {
                if (playerCar.speed !== 0) { // 動いている時のみステアリング可能
                    const steeringFactor = playerCar.maxSpeed > 0 ? Math.abs(playerCar.speed) / playerCar.maxSpeed : 0;
                    const currentTurnSpeed = playerCar.turnSpeed * steeringFactor / 5 * 2 / 3;
                    const turnDirection = playerCar.speed >= 0 ? 1 : -1;

                    if (leftPressed) {
                        playerCar.angle -= currentTurnSpeed * turnDirection;
                    }
                    if (rightPressed) {
                        playerCar.angle += currentTurnSpeed * turnDirection;
                    }
                }
            }

            // 摩擦の適用: ジョイスティックもキーボードも加速/減速操作をしていない場合
            if (!joystickStatus.moved && !keyboardWantsToMove) {
                if (playerCar.speed > 0) {
                    playerCar.speed = Math.max(0, playerCar.speed - playerCar.friction);
                } else if (playerCar.speed < 0) {
                    playerCar.speed = Math.min(0, playerCar.speed + playerCar.friction);
                }
            }
        } else {
            // AIカーのロジック
            const aiCar = car;

            // AI スタート遅延ロジック
            if (!aiCar.aiHasStarted) {
                if (aiCar.gameStartTime > 0 && currentTime >= aiCar.gameStartTime + aiCar.aiStartDelay) {
                    aiCar.aiHasStarted = true;
                }
            }

            if (aiCar.aiHasStarted) {
                const isEasyAi = aiDrivingMode === 'easy';
                // --- AI回避ロジック用実効値 (レーティングで変動) ---
                // レーティング50で基本値の70%、100で130%の距離を検知
                const distanceFactor = mapRange(aiCar.rating, 50, 100, 0.7, 1.3);
                const EFFECTIVE_OBSTACLE_DETECTION_DISTANCE_FORWARD = (CAR_HEIGHT * 5) * distanceFactor;
                
                // EFFECTIVE_AVOID_STEER_ANGLE の計算 (1度から20度の範囲)
                // この計算はレーティングに直接基づいており、問題ないため変更なし
                let degreesAvoidSteerAngle = 0.38 * aiCar.rating - 18;
                degreesAvoidSteerAngle = Math.max(1, Math.min(degreesAvoidSteerAngle, 20));
                const EFFECTIVE_AVOID_STEER_ANGLE = degreesAvoidSteerAngle * (Math.PI / 180); // ラジアンに変換
                
                const AI_LATERAL_AVOID_SPEED = isEasyAi ? 1.15 : 1.7;

                // レーティング50で基本値の80%、100で120%の幅を検知
                const widthFactor = mapRange(aiCar.rating, 50, 100, 0.8, 1.2);
                const EFFECTIVE_OBSTACLE_DETECTION_WIDTH_FACTOR = 1.0 * widthFactor;

                // --- AIブロッキングロジック用実効値 (攻撃性(aggression)で変動) ---
                const base_block_probability = 0.25;
                // 攻撃性による確率乗数 (aggression 0.0で0.2倍、1.0で1.8倍)
                const aggressionMultiplier = mapRange(aiCar.aggression, 0.0, 1.0, 0.2, 1.8);
                let effective_block_probability = base_block_probability * aggressionMultiplier;
                effective_block_probability = Math.max(0.05, Math.min(0.9, effective_block_probability)); // 確率を0.05～0.9の範囲にクランプ

                // 攻撃性に基づく後方検知距離と検知幅
                const aggressionFactorForBlocking = mapRange(aiCar.aggression, 0.0, 1.0, 0.7, 1.3); // 70%から130%の範囲
                const EFFECTIVE_BLOCK_DETECTION_DISTANCE_BEHIND = (CAR_HEIGHT * 3.0) * aggressionFactorForBlocking;
                const blockDetectionLanes = mapRange(aiCar.aggression, 0.0, 1.0, 2, 10); // 攻撃性0.0で2レーン、1.0で10レーン
                let effectiveBlockDetectionWidthLanes = Math.round(blockDetectionLanes);

                // --- AI回避ロジック用定数 (EFFECTIVE_OBSTACLE_DETECTION_DISTANCE_FORWARD に統合されたため、元の定数定義は不要) ---
                // const AI_OBSTACLE_DETECTION_WIDTH_FACTOR = 1.0; // EFFECTIVE_OBSTACLE_DETECTION_WIDTH_FACTOR を使用
                const AI_ANGLE_SMOOTH_FACTOR = 0.05;
                // --- AIブロッキングロジック用定数 ---
                // const AI_BLOCK_DETECTION_DISTANCE_BEHIND = CAR_HEIGHT * 3.0; // レーティングで変動するためEFFECTIVE_を使用
                // const AI_BLOCK_PROBABILITY = 0.3; // レーティングで変動するためeffective_を使用

                const current_trackCenterX = canvas.width / 2;
                const current_trackLeftEdge = current_trackCenterX - TRACK_WIDTH / 2;
                const current_trackRightEdge = current_trackCenterX + TRACK_WIDTH / 2;

                const AI_LANE_WIDTH = TRACK_WIDTH / NUM_AI_LANES; // 新しいTRACK_WIDTHで再計算される
                // AIレーン全体をコース左端から45px左に寄せる (以前は60px左だったのを15px右に移動)
                // WALL_OFFSET は 0 なので actualCourseVisibleCenterX は canvas.width / 2 と同じ
                const courseLeftEdgeX = current_trackLeftEdge - 50;

                let desiredX = aiCar.x;           // AIカーが目指すべきX座標、デフォルトは現在位置
                let targetAngleForSteering = -Math.PI / 2; // AIカーが目指すべき角度、デフォルトは直進
                let isAvoidingObstacle = false; // 障害物回避中かどうかのフラグ
                let strategicLaneChoiceMade = false; // 戦略的レーン選択を行ったか
                let blockingAttemptMade = false; // ブロッキング試行を行ったかどうかのフラグ
                let personalityMoveMade = false; // 個性に基づく移動を行ったかどうかのフラグ
                let isEvadingWallProximity = false; // 壁際回避中かどうかのフラグ
                let randomLaneChangeMade = false; // 低レートAIのランダムレーン変更フラグ

                // ヘルパー関数: X座標からレーンインデックスを取得
                const getLaneIndex = (xPos) => {
                    const index = Math.floor((xPos - courseLeftEdgeX) / AI_LANE_WIDTH);
                    return Math.max(0, Math.min(NUM_AI_LANES - 1, index)); // 範囲内に収める
                };

                // --- 1. 前方の障害物を検知・回避 (最優先) ---
                // (壁際回避のチェックは後方に移動したため、ここの条件から isEvadingWallProximity を削除)
                // if (!isEvadingWallProximity) { // 元の条件
                    for (const otherCar of cars) {
                        if (otherCar === aiCar || otherCar.hasFinished) continue;
                        const yDifference = aiCar.y - otherCar.y;
                        const xDifferenceAbs = Math.abs(aiCar.x - otherCar.x);

                        if (yDifference < EFFECTIVE_OBSTACLE_DETECTION_DISTANCE_FORWARD && yDifference > 0) {
                            if (xDifferenceAbs < CAR_WIDTH * EFFECTIVE_OBSTACLE_DETECTION_WIDTH_FACTOR) {
                                const currentAiLane = getLaneIndex(aiCar.x);
                                const obstacleActualLane = getLaneIndex(otherCar.x);
                                let determinedTargetLane = currentAiLane;
                                let potentialTargetLanes = [];

                                if (obstacleActualLane === currentAiLane) {
                                    if (currentAiLane - 1 >= 0) potentialTargetLanes.push(currentAiLane - 1);
                                    if (currentAiLane + 1 < NUM_AI_LANES) potentialTargetLanes.push(currentAiLane + 1);
                                    if (currentAiLane - 2 >= 0) potentialTargetLanes.push(currentAiLane - 2);
                                    if (currentAiLane + 2 < NUM_AI_LANES) potentialTargetLanes.push(currentAiLane + 2);
                                } else {
                                    const directionToAvoid = Math.sign(currentAiLane - obstacleActualLane);
                                    const oneLaneAway = currentAiLane + directionToAvoid;
                                    if (oneLaneAway >= 0 && oneLaneAway < NUM_AI_LANES) {
                                        potentialTargetLanes.push(oneLaneAway);
                                    }
                                    const twoLanesAway = currentAiLane + directionToAvoid * 2;
                                    if (twoLanesAway >= 0 && twoLanesAway < NUM_AI_LANES) {
                                        potentialTargetLanes.push(twoLanesAway);
                                    }
                                }

                                let validEvasionLanes = potentialTargetLanes.filter(lane => lane !== obstacleActualLane);

                                if (validEvasionLanes.length > 0) {
                                    determinedTargetLane = validEvasionLanes[Math.floor(Math.random() * validEvasionLanes.length)];
                                }

                                if (determinedTargetLane !== currentAiLane) {
                                    desiredX = courseLeftEdgeX + AI_LANE_WIDTH * determinedTargetLane + AI_LANE_WIDTH / 2;
                                    isAvoidingObstacle = true;
                                    break;
                                }
                            }
                        }
                        if (isAvoidingObstacle) break;
                    }
                // } // 元の if(!isEvadingWallProximity) の閉じ括弧

                // --- 2. 戦略的レーン選択 (前方障害物回避が作動していない場合) ---
                if (!isAvoidingObstacle) { // isEvadingWallProximity のチェックを削除
                    const currentAiLane = getLaneIndex(aiCar.x);
                    let laneCongestion = new Array(NUM_AI_LANES).fill(0); // 各レーンの混雑度 (前方車両数)

                    // 各レーンの混雑度を計算
                    for (const otherCar of cars) {
                        if (otherCar === aiCar || otherCar.hasFinished) continue; // 自分自身とゴール済みの車はスキップ
                        const yDifference = aiCar.y - otherCar.y; // 正ならotherCarが前方

                        if (yDifference > 0 && yDifference < EFFECTIVE_OBSTACLE_DETECTION_DISTANCE_FORWARD) {
                            const otherCarLane = getLaneIndex(otherCar.x);
                            if (otherCarLane >= 0 && otherCarLane < NUM_AI_LANES) {
                                laneCongestion[otherCarLane]++;
                            }
                        }
                    }

                    // レーティングに基づいて評価対象レーンと移動判断
                    const numSideLanesToEvaluate = Math.round(mapRange(aiCar.rating, 50, 100, 0, 4)); // 片側に評価するレーン数 (0～4)
                    let bestLane = currentAiLane; // 評価の結果、最適なレーン
                    let minCongestionInConsideredLanes = laneCongestion[currentAiLane];

                    // 左右の評価対象レーンをチェック
                    for (let i = 1; i <= numSideLanesToEvaluate; i++) {
                        const targetLaneLeft = currentAiLane - i;
                        if (targetLaneLeft >= 0) {
                            if (laneCongestion[targetLaneLeft] < minCongestionInConsideredLanes) {
                                minCongestionInConsideredLanes = laneCongestion[targetLaneLeft];
                                bestLane = targetLaneLeft;
                            }
                        }
                        const targetLaneRight = currentAiLane + i;
                        if (targetLaneRight < NUM_AI_LANES) {
                            if (laneCongestion[targetLaneRight] < minCongestionInConsideredLanes) {
                                minCongestionInConsideredLanes = laneCongestion[targetLaneRight];
                                bestLane = targetLaneRight;
                            }
                        }
                    }

                    // 移動判断の閾値 (レーティングが高いほど積極的に移動)
                    const congestionDifferenceThreshold = mapRange(aiCar.rating, 50, 100, 3.0, 1.0); // rating 50なら3台差、100なら1台差で移動

                    if (bestLane !== currentAiLane && (laneCongestion[currentAiLane] - minCongestionInConsideredLanes >= congestionDifferenceThreshold)) {
                        desiredX = courseLeftEdgeX + AI_LANE_WIDTH * bestLane + AI_LANE_WIDTH / 2;
                        strategicLaneChoiceMade = true;
                    }
                }
                // --- 戦略的レーン選択ロジックここまで ---

                // --- 3. AIブロッキングロジック (前方回避も戦略的レーン選択も行われなかった場合) ---
                if (!isAvoidingObstacle && !strategicLaneChoiceMade && Math.random() < effective_block_probability) { // isEvadingWallProximity のチェックを削除
                    const currentAiLane = getLaneIndex(aiCar.x);
                    let bestTargetToBlock = null;
                    let closestYDifference = EFFECTIVE_BLOCK_DETECTION_DISTANCE_BEHIND; // Start with max detection distance

                    for (const otherCar of cars) {
                        if (otherCar === aiCar || otherCar.hasFinished) continue; // 自分自身とゴール済みの車はスキップ

                        const yDifferenceBehind = otherCar.y - aiCar.y; // 正の値ならotherCarがaiCarより後方

                        // Basic conditions: behind, within detection range (implicitly via closestYDifference init),
                        // faster, and closer than previously found best.
                        //自分より遅い車もブロック対象に含めるため、速度条件を変更
                        if (yDifferenceBehind > 0 && // Must be behind
                            yDifferenceBehind < closestYDifference && // Must be closer than the current best candidate
                            // otherCar.speed > aiCar.speed) { // Original: And faster
                            otherCar.speed > aiCar.speed * 0.8) { // New: otherCar is at least 80% of aiCar's speed
                            const otherCarLane = getLaneIndex(otherCar.x);
                            // 後方の車が隣のレーンにいて、自分より速い場合
                            const laneDifference = Math.abs(currentAiLane - otherCarLane); // レーン差の絶対値
                            if (laneDifference >= 1 && laneDifference <= effectiveBlockDetectionWidthLanes) { // レーティングに応じた探知幅を使用
                                // ブロックを試みる: otherCarと同じレーンに移動しようとする
                                let targetBlockLane = otherCarLane;

                                // ターゲットレーンがコース範囲内か確認
                                if (targetBlockLane >= 0 && targetBlockLane < NUM_AI_LANES) {
                                    // This otherCar is a better candidate to block
                                    closestYDifference = yDifferenceBehind;
                                    bestTargetToBlock = otherCar;
                                }
                            }
                        }
                    }

                    // If a best target was identified, set desiredX to block it
                    if (bestTargetToBlock) {
                        const targetLaneForBlocking = getLaneIndex(bestTargetToBlock.x);
                        desiredX = courseLeftEdgeX + AI_LANE_WIDTH * targetLaneForBlocking + AI_LANE_WIDTH / 2;
                        blockingAttemptMade = true;
                    }
                }
                // --- AIブロッキングロジックここまで ---

                // --- 4. 個性に基づく行動 (回避、戦略、ブロックのいずれも行われなかった場合) ---
                if (!isAvoidingObstacle && !strategicLaneChoiceMade && !blockingAttemptMade) {
                    const currentAiLane = getLaneIndex(aiCar.x);
                    
                    // isAvoidingObstacle, strategicLaneChoiceMade, blockingAttemptMade のいずれも true でない場合にのみ、
                    // 個性に基づく位置取り（wall_hugger, center_keeper, lone_wolf など）を実行します。
                    // これにより、回避やブロックのロジックが100%優先されます。
                    
                    switch (aiCar.personality) {
                        case 'center_keeper':
                            const centerLanesStart = Math.floor(NUM_AI_LANES / 2) - 2; // 中央5レーンの開始
                            const centerLanesEnd = centerLanesStart + 4; // 中央5レーンの終了
                            if (currentAiLane < centerLanesStart || currentAiLane > centerLanesEnd) {
                                // 中央に最も近いレーンを選択
                                let targetLane = currentAiLane < centerLanesStart ? centerLanesStart : centerLanesEnd;
                                desiredX = courseLeftEdgeX + AI_LANE_WIDTH * targetLane + AI_LANE_WIDTH / 2;
                                personalityMoveMade = true;
                            }
                            break;

                        case 'risk_averter':
                            // この個性は「戦略的レーン選択」ロジックで既にある程度カバーされているが、
                            // ここではより積極的に、最も空いているレーンを探す動きを追加する
                            let laneCongestionForAverter = new Array(NUM_AI_LANES).fill(0);
                            for (const otherCar of cars) {
                                if (otherCar === aiCar || otherCar.hasFinished) continue;
                                const yDiff = aiCar.y - otherCar.y;
                                if (yDiff > 0 && yDiff < EFFECTIVE_OBSTACLE_DETECTION_DISTANCE_FORWARD * 1.5) { // より遠くまで見る
                                    laneCongestionForAverter[getLaneIndex(otherCar.x)]++;
                                }
                            }
                            let leastCongestedLane = -1;
                            let minCongestion = Infinity;
                            for (let i = 0; i < NUM_AI_LANES; i++) {
                                if (laneCongestionForAverter[i] < minCongestion) {
                                    minCongestion = laneCongestionForAverter[i];
                                    leastCongestedLane = i;
                                }
                            }
                            if (leastCongestedLane !== -1 && leastCongestedLane !== currentAiLane) {
                                desiredX = courseLeftEdgeX + AI_LANE_WIDTH * leastCongestedLane + AI_LANE_WIDTH / 2;
                                personalityMoveMade = true;
                            }
                            break;

                        case 'aggressor':
                            // この個性は「ブロッキング」ロジックでカバーされているため、ここでは特別な動きはなし
                            // ブロッキングの確率や検知範囲は aggression 値で調整済み
                            break;

                        case 'lone_wolf':
                            // 最も近くに車がいないレーンを探す
                            let laneDistances = new Array(NUM_AI_LANES).fill(Infinity);
                            for (let i = 0; i < NUM_AI_LANES; i++) {
                                let minDistanceInLane = Infinity;
                                for (const otherCar of cars) {
                                    if (otherCar === aiCar) continue;
                                    const otherCarLane = getLaneIndex(otherCar.x);
                                    if (otherCarLane === i) {
                                        const dist = Math.hypot(aiCar.x - otherCar.x, aiCar.y - otherCar.y);
                                        minDistanceInLane = Math.min(minDistanceInLane, dist);
                                    }
                                }
                                laneDistances[i] = minDistanceInLane;
                            }
                            const bestLaneForWolf = laneDistances.indexOf(Math.max(...laneDistances));
                            if (bestLaneForWolf !== currentAiLane) {
                                desiredX = courseLeftEdgeX + AI_LANE_WIDTH * bestLaneForWolf + AI_LANE_WIDTH / 2;
                                personalityMoveMade = true;
                            }
                            break;

                        case 'wall_hugger':
                            const targetLane = (aiCar.x < current_trackCenterX) ? 0 : NUM_AI_LANES - 1; // 左半分にいたら左端、右半分にいたら右端へ
                            if (currentAiLane !== targetLane) {
                                desiredX = courseLeftEdgeX + AI_LANE_WIDTH * targetLane + AI_LANE_WIDTH / 2;
                                personalityMoveMade = true;
                            }
                            break;

                        case 'slipstream_hunter':
                            let closestLeader = null;
                            let minDistance = SLIPSTREAM_DETECTION_DISTANCE_Y * 2; // スリップストリーム検知範囲の2倍まで探す

                            for (const otherCar of cars) {
                                if (otherCar === aiCar || otherCar.hasFinished) continue;
                                const yDiff = aiCar.y - otherCar.y;

                                if (yDiff > 0 && yDiff < minDistance) {
                                    minDistance = yDiff;
                                    closestLeader = otherCar;
                                }
                            }

                            if (closestLeader && getLaneIndex(aiCar.x) !== getLaneIndex(closestLeader.x)) {
                                desiredX = closestLeader.x; // ターゲットの真後ろを狙う
                                personalityMoveMade = true;
                            }
                            break;
                    }
                }

                // --- 5. 低レーティングAIのランダムレーン変更 (回避、戦略、ブロック、個性のいずれも行われなかった場合) ---
                if (!isAvoidingObstacle && !strategicLaneChoiceMade && !blockingAttemptMade && !personalityMoveMade &&
                    (!isEasyAi || currentTime >= (aiCar.aiLaneChangeCooldownUntil || 0))) {
                    const RANDOM_LANE_CHANGE_PROBABILITY_BASE = 0.1; // ランダム変更の基本確率
                    // レーティングが低いほど確率が上がる (例: 85で影響が出始め、50で最大影響)
                    const ratingEffectOnRandomChange = Math.max(0, (85 - aiCar.rating) / 35);
                    const randomLaneChangeProbability = RANDOM_LANE_CHANGE_PROBABILITY_BASE * ratingEffectOnRandomChange;

                    if (Math.random() < randomLaneChangeProbability) {
                        const currentAiLane = getLaneIndex(aiCar.x);
                        let potentialRandomLanes = [];
                        if (currentAiLane > 0) potentialRandomLanes.push(currentAiLane - 1); // 左へ
                        if (currentAiLane < NUM_AI_LANES - 1) potentialRandomLanes.push(currentAiLane + 1); // 右へ

                        if (potentialRandomLanes.length > 0) {
                            const randomTargetLane = potentialRandomLanes[Math.floor(Math.random() * potentialRandomLanes.length)];
                            desiredX = courseLeftEdgeX + AI_LANE_WIDTH * randomTargetLane + AI_LANE_WIDTH / 2;
                            randomLaneChangeMade = true;
                            if (isEasyAi) aiCar.aiLaneChangeCooldownUntil = currentTime + 1800;
                        }
                    }
                }
                // --- 6. 壁際回避ロジック (上記のいずれも作動していない場合) ---
                if (!isAvoidingObstacle && !strategicLaneChoiceMade && !blockingAttemptMade && !personalityMoveMade && !randomLaneChangeMade) {
                    const WALL_PROXIMITY_THRESHOLD_AI = CAR_WIDTH * 0.65;

                    // 左壁への接近判定ロジックは削除されました。

                    // 右壁への接近判定 (車の右端が壁に近づいているか。左壁回避が作動していない場合のみ)
                    if (aiCar.x + CAR_WIDTH > current_trackRightEdge - WALL_PROXIMITY_THRESHOLD_AI) {
                        const currentAiLane = getLaneIndex(aiCar.x);
                        let targetEvasionLane = -1;
                        for (let i = 1; i <= 2; i++) { // 左隣のレーンから最大2レーン先までチェック
                            const potentialLane = currentAiLane - i;
                            if (potentialLane >= 0) {
                                // (安全なレーンかどうかのチェックロジックは左壁と同様)
                                // ... (省略: isLaneSafe のチェック) ...
                                // 簡略化のため、上記左壁の isLaneSafe チェックを再利用すると仮定
                                // 実際には右壁用の targetEvasionLane を見つけるロジックが必要
                                // desiredX を設定するロジックが必要 (例: desiredX = courseLeftEdgeX + AI_LANE_WIDTH * potentialLane + AI_LANE_WIDTH / 2;)
                                // isEvadingWallProximity フラグは直接使われなくなるが、デバッグ用に残しても良い
                                isEvadingWallProximity = true; // 仮の代入
                            } else { break; }
                        }
                    }
                }
                // --- 壁衝突回避ロジックは撤去済み ---
                // courseLeftEdgeX は既にAIロジックの冒頭で新しい値で定義されています。

                const isTargetXDifferentAndNotReached = (desiredX !== aiCar.x) && (Math.abs(aiCar.x - desiredX) > AI_LATERAL_AVOID_SPEED * 0.05);
                aiCar.isCorneringForTireMarks = isTargetXDifferentAndNotReached;

                // ステアリング角度の設定
                if (isTargetXDifferentAndNotReached) {
                    if (desiredX < aiCar.x) { // 左へ移動
                        targetAngleForSteering = -Math.PI / 2 - EFFECTIVE_AVOID_STEER_ANGLE;
                    } else if (desiredX > aiCar.x) { // 右へ移動
                        targetAngleForSteering = -Math.PI / 2 + EFFECTIVE_AVOID_STEER_ANGLE;
                    }
                    // desiredX === aiCar.x の場合は targetAngleForSteering は -Math.PI / 2 のまま (直進)
                }

                // X座標の更新 (回避行動)
                if (isTargetXDifferentAndNotReached) {
                    if (isEasyAi) {
                        const lateralDelta = desiredX - aiCar.x;
                        aiCar.x += Math.sign(lateralDelta) * Math.min(Math.abs(lateralDelta) * 0.12, AI_LATERAL_AVOID_SPEED);
                    } else {
                        aiCar.x += Math.sign(desiredX - aiCar.x) * AI_LATERAL_AVOID_SPEED;
                    }
                } else if (aiCar.x !== desiredX) {
                    // 目標に十分近づいたら、正確な位置に設定
                    aiCar.x = desiredX;
                }

                if (isEasyAi) {
                    aiCar.angle = -Math.PI / 2;
                } else {
                    // Real (Hard) は従来どおり、速度に応じて目標角へステアリングする。
                    const aiSteeringSpeedFactor = aiCar.maxSpeed > 0.01
                        ? Math.abs(aiCar.speed) / aiCar.maxSpeed
                        : 0;
                    const effectiveAiAngleSmoothFactor = AI_ANGLE_SMOOTH_FACTOR * aiSteeringSpeedFactor;
                    aiCar.angle += (targetAngleForSteering - aiCar.angle) * effectiveAiAngleSmoothFactor;
                }

                // 前進ロジック
                // プレイヤーと同じ加速度と最高速度目標を使用
                const wantsToAccelerate = aiCar.speed < aiCar.maxSpeed;

                if (wantsToAccelerate) {
                    // 加速する場合のロジック (プレイヤーがアクセルを踏んでいる状態に相当)
                    const effectiveTargetMaxSpeed = aiCar.speed >= 0 ? aiCar.maxSpeed : aiCar.maxSpeedReverse;
                    const speedFactor = Math.abs(aiCar.speed) / effectiveTargetMaxSpeed; // effectiveTargetMaxSpeed が0でないことを期待
                    const currentAcceleration = aiCar.acceleration * getCurrentAccelerationFactor(aiCar) * (1 - speedFactor);
                    aiCar.speed = Math.min(aiCar.speed + currentAcceleration, aiCar.maxSpeed);
                } else {
                    // 加速していない場合 (最高速度に達しているか、または減速を意図する場合)
                    // プレイヤーがアクセルを離している状態に相当し、摩擦が適用される
                    if (aiCar.speed > 0) {
                        aiCar.speed = Math.max(0, aiCar.speed - aiCar.friction);
                    }
                    // AIはこのシンプルなモデルでは後退しないため、後退時の摩擦は考慮しない
                }
            } else { // if (!aiCar.aiHasStarted)
                aiCar.speed = 0; // Keep speed at 0 if not yet started
            }
        }

        // 注意: この時点ではx, yはまだ更新しない
    }

    // パス2: 全ての車の基本的な移動を適用 (x, y座標を更新)
    for (let i = 0; i < cars.length; i++) {
        const car = cars[i];
        const previousY = car.y;
        car.x += Math.cos(car.angle) * car.speed;
        car.y += Math.sin(car.angle) * car.speed;

        // 接触で受けた横方向の反動を数フレーム残し、弾かれた感触を作る。
        if (Math.abs(car.lateralVelocity) > 0.02) {
            car.x += car.lateralVelocity;
            car.lateralVelocity *= 0.90;
        } else {
            car.lateralVelocity = 0;
        }

        if ((gameState === 'race' || gameState === 'finished') && Math.abs(car.speed) > 0.25) {
            recordTireMarks(car);
        }

        if ((gameState === 'race' || gameState === 'finished') && car.y < previousY) {
            const passedCheckpointIndex = Math.floor(Math.max(0, -car.y) / TIMING_POINT_SPACING_PX);
            while (car.lastTimingCheckpointIndex < passedCheckpointIndex) {
                const checkpointIndex = car.lastTimingCheckpointIndex + 1;
                const checkpointY = -checkpointIndex * TIMING_POINT_SPACING_PX;
                const frameTravel = previousY - car.y;
                const crossingFraction = frameTravel > 0
                    ? Math.max(0, Math.min(1, (previousY - checkpointY) / frameTravel))
                    : 1;
                const estimatedCrossingTime = currentTime - (1 - crossingFraction) * (1000 / ASSUMED_FPS);
                car.timingCheckpointTimes[checkpointIndex] = estimatedCrossingTime;
                car.lastTimingCheckpointIndex = checkpointIndex;
            }
        }
    }

    // パス2.5: ゴール判定
    if (gameState === 'race') { // レース中のみゴール判定を行う
        // Y座標でソートして、同着の場合でも正しく順位をつけられるようにする準備
        const carsToCheckFinish = [...cars].sort((a,b) => a.y - b.y);

        carsToCheckFinish.forEach((car) => {
            if (!car.hasFinished && car.y <= GOAL_LINE_Y_POSITION) {
                car.hasFinished = true;
                car.finishTime = currentTime;
                carsFinishedCount++;
                // finalRank は carsFinishedCount に基づいて設定されるため、
                // 複数の車が同フレームでゴールした場合、処理順でランクが決まる可能性がある。
                // より厳密には、このループの前に y でソートされたリストを使うべきだが、
                // carsFinishedCount がインクリメントされるため、最初の車が rank 1 を取る。
                car.finalRank = carsFinishedCount;
                // car.speed = 0; // ゴールしたら停止させる場合

                const originalCarIndex = cars.findIndex(c => c === car); // 元のcars配列でのインデックスを取得
                if (raceMode === 'single' && originalCarIndex === playerCarIndex) {
                    gameState = 'finished';
                } else if (raceMode === 'versus') {
                    const allPlayersFinished = playerCarIndices.every(playerIndex => cars[playerIndex]?.hasFinished);
                    if (allPlayersFinished) gameState = 'finished';
                }

                // 最初にゴールした車のタイムを記録
                if (car.finalRank === 1 && winnerFinishTime === 0) {
                    winnerFinishTime = car.finishTime;
                }
            }
        });

    } else if (gameState === 'finished') {
        // レース終了後もAIカーがゴール判定を通過できるようにする
        cars.forEach(car => {
            if (!car.hasFinished && car.y <= GOAL_LINE_Y_POSITION) {
                car.hasFinished = true;
                if (car.finishTime === 0) car.finishTime = currentTime; // まだタイムがなければ設定
                if (car.finalRank === 0) { // まだ最終順位がなければ設定
                    carsFinishedCount++;
                    car.finalRank = carsFinishedCount;
                    // プレイヤーがゴール後にAIが最初にゴールする場合のwinnerFinishTimeも考慮
                    if (car.finalRank === 1 && winnerFinishTime === 0) {
                        winnerFinishTime = car.finishTime;
                    }
                }
            }
        });
    }

    // レース履歴の記録: gameStateが 'race' または 'finished' の間は記録を続ける
    // 記録停止は gameState が 'all_finished' に遷移することで制御される
    if (gameState === 'race' || gameState === 'finished') { // キャリアモードでも記録するように変更
        const currentCarStates = cars.map(car => ({
            x: car.x, y: car.y, angle: car.angle, speed: car.speed,
            hasFinished: car.hasFinished, finalRank: car.finalRank // ゴール情報も記録
        }));
        raceHistory.push({ carStates: currentCarStates, timestamp: currentTime });
    }

    // gameState を 'all_finished' に遷移させる条件のチェック
    // このチェックは、現在のフレームのレース履歴が記録された後に行う
    if ((gameState === 'race' || gameState === 'finished') && !(gameState === 'all_finished')) { // all_finished にまだ遷移していない場合のみ
        const allCarsPhysicallyFinished = (carsFinishedCount >= cars.length);
        const thirtySecondsPastWinner = (winnerFinishTime > 0 && currentTime >= winnerFinishTime + 30000);

        if (allCarsPhysicallyFinished || thirtySecondsPastWinner) {
            gameState = 'all_finished';
            console.log(`Race ${currentRaceInSeason}/${RACES_PER_SEASON} of Season ${currentSeasonNumber} ended. All cars physically finished: ${allCarsPhysicallyFinished}, 30s past winner: ${thirtySecondsPastWinner}. Transitioning to all_finished.`);

            // --- ポイント加算処理 (キャリアモードの場合のみ) ---
            if (careerPlayerTeamName) {
                cars.forEach(car => {
                    const currentRacePointsSystem = currentRaceType.points; // 現在のレースのポイントシステムを使用
                    if (car.hasFinished && car.finalRank > 0 && car.finalRank <= currentRacePointsSystem.length) {
                        const pointsEarned = currentRacePointsSystem[car.finalRank - 1];
                        if (!careerDriverSeasonPoints[car.driverName]) {
                            careerDriverSeasonPoints[car.driverName] = 0;
                        }
                        careerDriverSeasonPoints[car.driverName] += pointsEarned;
                        console.log(`${car.driverName} (Rank: ${car.finalRank}) earned ${pointsEarned} points. Total: ${careerDriverSeasonPoints[car.driverName]}`);
                    }
                });

                // チームポイントの更新 (シーズン累計)
                // careerDriverSeasonPoints を元に全チームのポイントを再集計する
                // driverLineups は現在のシーズンのチーム構成を反映している
                for (const teamNameInLineup in driverLineups) {
                    careerTeamSeasonPoints[teamNameInLineup] = 0; // 毎回リセットして再計算
                    const team = driverLineups[teamNameInLineup];
                    team.drivers.forEach(driver => {
                        if (careerDriverSeasonPoints[driver.name]) {
                            careerTeamSeasonPoints[teamNameInLineup] += careerDriverSeasonPoints[driver.name];
                        }
                    });
                }
                console.log("Career Team Season Points updated:", JSON.parse(JSON.stringify(careerTeamSeasonPoints)));

                // キャリアモードのレース終了時に、次レースのグリッド順のために結果を保存
                const finishedCarsSortedForGrid = [...cars]
                    .filter(c => c.hasFinished && c.finalRank > 0) // 完走し、有効な順位を持つ車のみ
                    .sort((a, b) => a.finalRank - b.finalRank);

                if (finishedCarsSortedForGrid.length === NUM_CARS) { // 全車分の結果があるか確認
                    previousRaceFinishingOrder = finishedCarsSortedForGrid.map(c => c.driverName);
                    console.log("Previous race finishing order stored for next race grid:", previousRaceFinishingOrder);
                } else {
                    console.warn(`Could not store previous race finishing order for next grid. Expected ${NUM_CARS} ranked cars, found ${finishedCarsSortedForGrid.length}. Next race will use default grid.`);
                    previousRaceFinishingOrder = []; // 不完全な場合はリセットしてデフォルトグリッドにフォールバック
                };

                // --- 資金加算処理 (キャリアモードの場合のみ) ---
                cars.forEach(car => {
                    if (car.hasFinished && car.finalRank > 0 && car.finalRank <= fundsByRank.length) {
                        const earnedFunds = fundsByRank[car.finalRank - 1];
                        if (driverLineups[car.teamName]) {
                            if (driverLineups[car.teamName].funds === undefined) {
                                driverLineups[car.teamName].funds = 0;
                            }
                            driverLineups[car.teamName].funds += earnedFunds;
                            console.log(`Team ${car.teamName} (Driver: ${car.driverName}, Rank: ${car.finalRank}) earned ${earnedFunds} funds. Total funds: ${driverLineups[car.teamName].funds}`);
                        }
                    }
                });
            }
            // --- ポイント加算処理ここまで ---

            // === 自動セーブ処理 (キャリアモードの場合のみ) ===
            // if (careerPlayerTeamName) {
            //     const autoSaveSlotIndex = 0; // 自動セーブはスロット0に固定
            //     // gatherSaveDataは現在のgameState ('all_finished') を使用してセーブデータを作成します。
            //     // previousGameStateBeforeSaveLoad はこの時点ではnullなので、
            //     // gatherSaveData内の currentGameStateToSave は gameState ('all_finished') になります。
            //     const saveData = gatherSaveData();
            //     saveGameToSlot(autoSaveSlotIndex, saveData);
            //     loadSaveSlotsMetadata(); // セーブスロットのメタデータを更新
            //     console.log(`Game automatically saved to Slot ${autoSaveSlotIndex + 1} after race finish.`);
            //     alert(`レース結果がスロット ${autoSaveSlotIndex + 1} に自動セーブされました。`);
            // }
            // === 自動セーブ処理ここまで ===

            if (!replayButton.isVisible) { // ボタンがまだ表示されていなければ設定
                // ボタンのX位置をキャリアとクイックレースで共通化
                const commonButtonX = canvas.width / 2 - replayButton.width / 2; // replayButtonの幅を基準に中央揃え
                replayButton.x = commonButtonX;
                replayButton.y = canvas.height - replayButton.height - 30;
                replayButton.isVisible = true; // キャリアモードでもリプレイボタンを表示する
                if (careerPlayerTeamName) {
                    careerNextButton.isVisible = true; // キャリアならNEXTボタンも表示
                } else {
                    quickRaceBackButton.isVisible = true; // クイックレースならBackボタン表示
                }
            }
        }
    }

    // レース開始後1秒でシグナルを完全に非表示にするロジック (レース中のみ)
    // このロジックは gameState の変更とは独立して動作
    if (gameState === 'race' && signalLightsOnCount === -1 && raceActualStartTime > 0 && (currentTime - raceActualStartTime > 1000)) {
        signalLightsOnCount = SIGNAL_NUM_LIGHTS + 1; // シグナルを非表示にするための特別な値
    }

    // パス3: 車同士の衝突判定と応答
    for (let i = 0; i < cars.length; i++) {
        for (let j = i + 1; j < cars.length; j++) {
            const carA = cars[i];
            const carB = cars[j];

            const aabbA = getRotatedAABB(carA);
            const aabbB = getRotatedAABB(carB);

            // AABBで候補を絞り、最後は車体角に追従する回転矩形で判定する。
            if (aabbA.maxX > aabbB.minX &&
                aabbA.minX < aabbB.maxX &&
                aabbA.maxY > aabbB.minY &&
                aabbA.minY < aabbB.maxY &&
                rotatedCarsOverlap(carA, carB)) {

                const contactTime = Date.now();
                const isFreshContact = contactTime - Math.max(carA.lastCarContactTime || 0, carB.lastCarContactTime || 0) > 170;

                const playerInvolved = playerCarIndices.includes(i) || playerCarIndices.includes(j);

                if (isFreshContact && (aiDrivingMode === 'real' || playerInvolved)) {
                    const centerAX = carA.x + CAR_WIDTH / 2;
                    const centerBX = carB.x + CAR_WIDTH / 2;
                    const separationDirection = centerAX === centerBX ? (i < j ? -1 : 1) : Math.sign(centerAX - centerBX);
                    const relativeSpeed = Math.abs(carA.speed - carB.speed);
                    const impact = Math.min(7.0, 3.5 + relativeSpeed * 0.7);

                    carA.lateralVelocity = (carA.lateralVelocity || 0) + separationDirection * impact;
                    carB.lateralVelocity = (carB.lateralVelocity || 0) - separationDirection * impact;
                    carA.x += separationDirection * 2;
                    carB.x -= separationDirection * 2;
                    carA.lastCarContactTime = contactTime;
                    carB.lastCarContactTime = contactTime;

                    if (playerInvolved) {
                        triggerCameraShake(Math.min(15, 7 + relativeSpeed * 1.4));
                    }
                }

                // Y座標を比較して後方にいた車を特定 (Yが大きい方が後方)
                if (carA.y > carB.y) { // carAがcarBの後方
                    if (!carsSpeedReducedThisFrame.has(i)) {
                        carA.speed *= 0.95;
                        carsSpeedReducedThisFrame.add(i);
                    }
                } else if (carB.y > carA.y) { // carBがcarAの後方
                    if (!carsSpeedReducedThisFrame.has(j)) {
                        carB.speed *= 0.95;
                        carsSpeedReducedThisFrame.add(j);
                    }
                }
                // Y座標が全く同じ場合は、このルールではどちらも減速しない
            }
        }
    }
    // パス4: 壁との衝突判定と最高速度超過時の処理
    for (let i = 0; i < cars.length; i++) {
        const car = cars[i];
        const trackCenterX = canvas.width / 2;
        // WALL_OFFSET は 0 なので、トラックの描画上の端が壁となる
        const trackLeftEdge = trackCenterX - TRACK_WIDTH / 2 + WALL_OFFSET;
        const trackRightEdge = trackCenterX + TRACK_WIDTH / 2 - WALL_OFFSET; // WALL_OFFSETが0なので実際は TRACK_WIDTH/2

        // const cosAngle = Math.cos(car.angle); // AABB関数内で計算
        // const sinAngle = Math.sin(car.angle);

        // 車の中心座標
        const carCenterX = car.x + CAR_WIDTH / 2;
        // const carCenterY = car.y + CAR_HEIGHT / 2; // Y座標は芝生判定に直接使わない

        // 車の中心を原点としたときの四隅のローカル座標
        const corners = [
            { x: -CAR_WIDTH / 2, y: -CAR_HEIGHT / 2 }, // 左上
            { x:  CAR_WIDTH / 2, y: -CAR_HEIGHT / 2 }, // 右上
            { x:  CAR_WIDTH / 2, y:  CAR_HEIGHT / 2 }, // 右下
            { x: -CAR_WIDTH / 2, y:  CAR_HEIGHT / 2 }  // 左下
        ];

        // 回転を考慮したAABBを取得
        const aabb = getRotatedAABB(car);
        let hitWall = false;

        if (aabb.minX < trackLeftEdge) {
            // 左の壁に衝突
            car.x += (trackLeftEdge - aabb.minX); // 位置を補正
            hitWall = true;
        }
        if (aabb.maxX > trackRightEdge) {
            // 右の壁に衝突
            car.x -= (aabb.maxX - trackRightEdge); // 位置を補正
            hitWall = true;
        }

        if (hitWall) {
            // X方向の速度成分を反転させることで跳ね返りを表現
            const speedX = Math.cos(car.angle) * car.speed;
            const speedY = Math.sin(car.angle) * car.speed;

            // X方向の速度を反転
            // Use a higher factor (e.g., 1.0 for perfect elasticity in X) for angle calculation
            // The overall speed reduction is handled separately below.
            // Using 1.0 here means the X-component of velocity reverses perfectly for angle calculation.
            // const newSpeedX = -speedX * 1.0; // 目標角度を固定するため不要

            // Calculate the desired post-collision angle based on velocity vectors
            // const desiredAngle = Math.atan2(speedY, newSpeedX); // 元のロジック
            // car.collisionTargetAngle = desiredAngle; // 元のロジック
            const isPlayerCar = playerCarIndices.includes(i);
            if (aiDrivingMode === 'real' || isPlayerCar) {
                car.collisionTargetAngle = -Math.PI / 2;
                car.isRotatingFromCollision = true;
            } else {
                car.angle = -Math.PI / 2;
                car.collisionTargetAngle = null;
                car.isRotatingFromCollision = false;
            }

            if (Math.abs(car.speed) < 0.1) car.speed = 0; // 非常に低速なら停止
        }

        // 最高速度超過時のゆったりとした減速処理
        if (car.speed > car.maxSpeed) {
            car.speed -= OVER_MAX_SPEED_DECELERATION;
            // 減速しすぎて最高速度を下回った場合は、最高速度にクランプする (ただし、衝突直後の速度減衰とは別)
            // 衝突による速度減衰は既に car.speed *= 0.95 で行われている
            if (car.speed < car.maxSpeed) {
                car.speed = car.maxSpeed; // 修正: 最高速度に設定
            }
        } else if (car.speed < -car.maxSpeedReverse) {
            car.speed += OVER_MAX_SPEED_DECELERATION;
            // 加速（絶対値としては減速）しすぎて後退最高速度を上回った場合は、後退最高速度にクランプする
            if (car.speed > -car.maxSpeedReverse) {
                car.speed = -car.maxSpeedReverse;
            }
        }

        // Apply 90% speed reduction upon collision (moved from inside hitWall block) - 減速処理を削除
        // if (hitWall) {
        //      car.speed *= 0.9; // Reduce speed to 90% upon collision
        // }
    }

    // 通常のレース中のカメラ追従ロジック
    // gameStateが 'race', 'finished', 'all_finished' の場合に実行
    // (signal_sequence および replay 中は、それぞれの専用関数内でカメラが制御される)
    if (gameState === 'race' || gameState === 'finished' || gameState === 'all_finished') {
        const playerCarForCamera = cars[playerCarIndex];
        const player2CarForCamera = raceMode === 'versus' ? cars[secondPlayerCarIndex] : null;
        cameraOffsetX = (canvas.width / 2) - (canvas.width / 2 / ZOOM_LEVEL);

        // プレイヤーオブジェクトやそのY座標が有効かチェック
        if (playerCarForCamera && typeof playerCarForCamera.y === 'number' && isFinite(playerCarForCamera.y)) {
            // プレイヤーの車がY軸方向の中央に来るように調整 (ZOOM_LEVEL を考慮)
            const focusY = player2CarForCamera && Number.isFinite(player2CarForCamera.y)
                ? (playerCarForCamera.y + player2CarForCamera.y) / 2
                : playerCarForCamera.y;
            cameraOffsetY = focusY + (CAR_HEIGHT / 2) - (canvas.height * PLAYER_CAMERA_Y_POSITION_RATIO / ZOOM_LEVEL);
        } else {
            // console.error("Camera tracking failed during race: Player data invalid.");
        }
    }
} // update関数の閉じ括弧を追加

// === リプレイ更新ロジック ===
function handleReplayUpdate() {
    const currentTime = Date.now();
    const deltaTime = currentTime - lastReplayUpdateTime;
    // lastReplayUpdateTime = currentTime; //  !isReplayPaused の中で更新

    if (!isReplayPaused && raceHistory.length > 0) {
        lastReplayUpdateTime = currentTime; // 再生中のみ時刻を更新

        // 再生速度と経過時間に基づいてフレームを進める
        const framesToAdvance = Math.round(deltaTime / (1000 / ASSUMED_FPS) * replaySpeedMultiplier);

        replayFrameIndex += framesToAdvance;

        if (replayFrameIndex >= raceHistory.length - 1) {
            replayFrameIndex = raceHistory.length - 1; // 最終フレームに留まる
            isReplayPaused = true; // 最後まで行ったら一時停止
            if (careerPlayerTeamName) {
                careerReplayBackButton.isVisible = true; // キャリアモードなら「結果に戻る」ボタンを表示
                careerReplayAgainButton.isVisible = true; // 「もう一度リプレイを見る」ボタンも表示
                // replayButton.isVisible should remain false here
            } else {
                replayButton.isVisible = true; // クイックレースなら通常のリプレイボタンを再表示
                careerReplayBackButton.isVisible = false; // Ensure hidden
                careerReplayAgainButton.isVisible = false; // Ensure hidden
            }
            // ボタンの位置が未設定の場合（通常は 'all_finished' で設定されるが念のため）
            if (replayButton.x === 0 && replayButton.y === 0 && !careerPlayerTeamName) { // Non-career
                 replayButton.x = canvas.width / 2 - replayButton.width / 2;
                 replayButton.y = canvas.height - replayButton.height - 30;
            }
            console.log("Replay ended.");
        } else if (replayFrameIndex < 0) {
            replayFrameIndex = 0;
        }

        // 記録された状態を現在の車の状態に適用
        const currentFrameData = raceHistory[replayFrameIndex];
        currentFrameData.carStates.forEach((recordedState, index) => {
            // 描画のために、実際のcars配列のプロパティを上書きする
            Object.assign(cars[index], recordedState);
        });

        // カメラ位置を更新 (選択された車の記録された位置に追尾)
        const followedCarState = cars[selectedReplayCarIndex]; // cars配列は既にリプレイデータで更新されている
        cameraOffsetX = (canvas.width / 2) - (canvas.width / 2 / ZOOM_LEVEL);
        cameraOffsetY = followedCarState.y + (CAR_HEIGHT / 2) - (canvas.height * PLAYER_CAMERA_Y_POSITION_RATIO / ZOOM_LEVEL); // Yは追尾
    }

    // TODO: リプレイ操作UIの入力処理 (マウスイベントなど)
}

// === 新しい描画関数: ドライバー選択画面 ===
function drawMultiplayerSetupScreen() {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#090d13');
    gradient.addColorStop(1, '#18212d');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = '900 34px "Arial Black", Arial';
    ctx.fillText('MULTIPLAYER', canvas.width / 2, 72);
    ctx.fillStyle = '#8f99a8';
    ctx.font = '700 13px Arial';
    ctx.fillText('PLAYERS AND CPU GRID', canvas.width / 2, 96);

    const countGap = 16;
    const countTotalWidth = multiplayerSetupButtons.playerCounts.length * 110 + countGap * 2;
    multiplayerSetupButtons.playerCounts.forEach((button, index) => {
        button.x = canvas.width / 2 - countTotalWidth / 2 + index * (button.width + countGap);
        button.y = 145;
        const selected = multiplayerPlayerCount === button.count;
        ctx.fillStyle = selected ? '#ff4d00' : '#222b36';
        ctx.strokeStyle = selected ? '#ff9b72' : '#465363';
        ctx.beginPath();
        ctx.roundRect(button.x, button.y, button.width, button.height, 7);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 20px Arial';
        ctx.fillText(`${button.count} PLAYERS`, button.x + button.width / 2, button.y + 32);
    });

    const cpuButton = multiplayerSetupButtons.cpu;
    cpuButton.x = canvas.width / 2 - cpuButton.width / 2;
    cpuButton.y = 225;
    ctx.fillStyle = cpuOpponentsEnabled ? '#153744' : '#222b36';
    ctx.strokeStyle = cpuOpponentsEnabled ? '#29d9ff' : '#596370';
    ctx.beginPath();
    ctx.roundRect(cpuButton.x, cpuButton.y, cpuButton.width, cpuButton.height, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = cpuOpponentsEnabled ? '#7de9ff' : '#a3acb8';
    ctx.font = '900 17px Arial';
    ctx.fillText(`CPU CARS  ${cpuOpponentsEnabled ? 'ON' : 'OFF'}`, canvas.width / 2, cpuButton.y + 32);

    const aiModeButton = multiplayerSetupButtons.aiMode;
    aiModeButton.x = canvas.width / 2 - aiModeButton.width / 2;
    aiModeButton.y = 287;
    const isRealMode = aiDrivingMode === 'real';
    ctx.fillStyle = isRealMode ? '#3a2119' : '#173244';
    ctx.strokeStyle = isRealMode ? '#ff7043' : '#5ecbff';
    ctx.beginPath();
    ctx.roundRect(aiModeButton.x, aiModeButton.y, aiModeButton.width, aiModeButton.height, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = isRealMode ? '#ff9a78' : '#8cddff';
    ctx.font = '900 16px Arial';
    ctx.fillText(`AI  ${isRealMode ? 'REAL (HARD)' : 'EASY'}`, canvas.width / 2, aiModeButton.y + 32);

    const startButton = multiplayerSetupButtons.start;
    startButton.x = canvas.width / 2 - startButton.width / 2;
    startButton.y = 355;
    ctx.fillStyle = '#ff4d00';
    ctx.beginPath();
    ctx.roundRect(startButton.x, startButton.y, startButton.width, startButton.height, 7);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 19px Arial';
    ctx.fillText('SELECT MACHINES →', canvas.width / 2, startButton.y + 35);

    const backButton = multiplayerSetupButtons.back;
    ctx.fillStyle = '#222b36';
    ctx.strokeStyle = '#465363';
    ctx.beginPath();
    ctx.roundRect(backButton.x, backButton.y, backButton.width, backButton.height, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 13px Arial';
    ctx.fillText('← BACK', backButton.x + backButton.width / 2, backButton.y + 24);

    ctx.fillStyle = '#7f8997';
    ctx.font = '700 11px Arial';
    ctx.fillText('P1 WASD  •  P2 ARROWS  •  P3 IJKL  •  P4 NUMPAD 8/5/4/6', canvas.width / 2, 448);
}

function drawMultiplayerDriverSelectionScreen() {
    ctx.fillStyle = '#080c12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const viewports = getMultiplayerViewports();
    const selectedNames = new Map();
    multiplayerSelections.forEach((selection, index) => {
        if (selection) selectedNames.set(selection.driverName, index);
    });

    viewports.forEach((viewport, player) => {
        const color = MULTIPLAYER_COLORS[player];
        ctx.save();
        ctx.beginPath();
        ctx.rect(viewport.x, viewport.y, viewport.width, viewport.height);
        ctx.clip();
        ctx.fillStyle = player % 2 === 0 ? '#101720' : '#131b25';
        ctx.fillRect(viewport.x, viewport.y, viewport.width, viewport.height);
        ctx.fillStyle = color;
        ctx.fillRect(viewport.x, viewport.y, 5, viewport.height);
        ctx.textAlign = 'left';
        ctx.fillStyle = color;
        ctx.font = '900 18px Arial';
        ctx.fillText(`P${player + 1}`, viewport.x + 13, viewport.y + 25);
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 11px Arial';
        const selection = multiplayerSelections[player];
        ctx.fillText(selection ? getDriverLastName(selection) : 'SELECT MACHINE', viewport.x + 50, viewport.y + 24);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#8f99a8';
        ctx.fillText(MULTIPLAYER_CONTROL_LABELS[player], viewport.x + viewport.width - 12, viewport.y + 24);

        getMultiplayerDriverButtons(viewport).forEach(button => {
            const pickedBy = selectedNames.get(button.driver.name);
            const selectedHere = pickedBy === player;
            const unavailable = pickedBy !== undefined && pickedBy !== player;
            const hovered = pointInRect(currentMouseX, currentMouseY, button);
            const accent = TEAM_ACCENT_COLORS[button.teamName] || '#ffffff';
            ctx.fillStyle = selectedHere ? '#3a3420' : (unavailable ? '#161a20' : (hovered ? '#303a46' : '#222a34'));
            ctx.strokeStyle = selectedHere ? color : '#35404c';
            ctx.beginPath();
            ctx.roundRect(button.x, button.y, button.width, button.height, 4);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = unavailable ? '#59616c' : '#ffffff';
            ctx.textAlign = 'left';
            ctx.font = `800 ${viewport.height >= 400 ? 12 : 10}px Arial`;
            ctx.fillText(getDriverLastName(button.driver), button.x + 7, button.y + button.height / 2 + 4);
            ctx.fillStyle = accent;
            ctx.fillRect(button.x, button.y, 3, button.height);
            const image = loadedCarImageObjects[button.team.image];
            if (image && image.complete && button.width > 100) {
                const imageWidth = Math.min(45, button.width * 0.32);
                ctx.drawImage(image, button.x + button.width - imageWidth - 5, button.y + button.height / 2 - 9, imageWidth, 18);
            }
        });
        ctx.restore();
    });

    ctx.fillStyle = '#05070a';
    ctx.fillRect(canvas.width / 2 - 2, 0, 4, canvas.height);
    if (multiplayerPlayerCount >= 3) ctx.fillRect(0, canvas.height / 2 - 2, canvas.width, 4);
}

function drawDriverSelectionScreen() {
    ctx.save();

    if (!careerPlayerTeamName) {
        if (raceMode === 'versus') {
            drawMultiplayerDriverSelectionScreen();
            ctx.restore();
            return;
        }
        const background = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        background.addColorStop(0, '#0c1016');
        background.addColorStop(1, '#171d26');
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ff4d00';
        ctx.fillRect(20, 20, 5, 48);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 28px "Arial Black", Arial';
        ctx.fillText(raceMode === 'versus' ? `MULTIPLAYER — P${versusSelectionPlayer}` : 'QUICK RACE', 40, 43);
        ctx.fillStyle = '#8f99a8';
        ctx.font = '700 12px Arial';
        const selectionHint = raceMode === 'versus'
            ? (versusSelectionPlayer === 1 ? 'P1: SELECT A DRIVER  /  WASD' : 'P2: SELECT A DRIVER  /  ARROW KEYS')
            : 'SELECT A DRIVER  /  MACHINE PERFORMANCE ×1.5';
        ctx.fillText(selectionHint, 40, 63);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#7de9ff';
        ctx.font = '800 11px Arial';
        ctx.fillText(currentRaceType.name.toUpperCase(), canvas.width - 20, 43);
        ctx.fillStyle = '#8f99a8';
        ctx.fillText(`DRS ${drsEnabled ? 'ON' : 'OFF'}  •  500m INTERVAL`, canvas.width - 20, 62);

        const cards = getQuickRaceSelectionLayout();
        cards.forEach(card => {
            const color = TEAM_ACCENT_COLORS[card.teamName] || '#ffffff';
            ctx.fillStyle = '#151b23';
            ctx.strokeStyle = '#2b3440';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(card.x, card.y, card.width, card.height, 7);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = color;
            ctx.fillRect(card.x, card.y, 4, card.height);
            ctx.fillStyle = '#ffffff';
            ctx.font = '800 13px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(card.teamName.toUpperCase(), card.x + 10, card.y + 19);
            const machineImage = loadedCarImageObjects[card.team.image];
            if (machineImage && machineImage.complete) {
                const imageWidth = Math.min(106, card.width - 20);
                const imageHeight = imageWidth * (CAR_HEIGHT / CAR_WIDTH);
                ctx.drawImage(machineImage, card.x + (card.width - imageWidth) / 2, card.y + 25, imageWidth, imageHeight);
            }

            const barX = card.x + 10;
            const barWidth = card.width - 20;
            const performance = getMachinePerformanceDisplay(card.team);
            ctx.fillStyle = '#8f99a8';
            ctx.font = '700 9px Arial';
            ctx.textAlign = 'left';
            ctx.fillText('最高速', barX, card.y + 75);
            ctx.fillStyle = '#ffffff';
            ctx.font = '900 12px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(`${performance.topSpeedKmh} km/h`, card.x + card.width - 10, card.y + 75);
            drawPerformanceBar(barX, card.y + 91, barWidth, '低速', performance.lowSpeedAcceleration, color);
            drawPerformanceBar(barX, card.y + 104, barWidth, '中速', performance.midSpeedAcceleration, color);
            drawPerformanceBar(barX, card.y + 117, barWidth, '高速', performance.highSpeedAcceleration, color);

            card.team.drivers.forEach((driver, driverIndex) => {
                const buttonX = card.x + 9;
                const buttonY = card.y + 125 + driverIndex * 23;
                const isHovered = currentMouseX >= buttonX && currentMouseX <= buttonX + card.width - 18 &&
                    currentMouseY >= buttonY && currentMouseY <= buttonY + 20;
                const isPlayerOnePick = raceMode === 'versus' && chosenPlayerInfo.driverName === driver.name;
                ctx.fillStyle = isPlayerOnePick ? '#554b1f' : (isHovered ? '#354151' : '#222a35');
                ctx.beginPath();
                ctx.roundRect(buttonX, buttonY, card.width - 18, 20, 4);
                ctx.fill();
                if (isHovered) {
                    ctx.strokeStyle = color;
                    ctx.stroke();
                }
                ctx.fillStyle = '#ffffff';
                ctx.font = '800 11px Arial';
                ctx.textAlign = 'left';
                ctx.fillText(getDriverLastName(driver), buttonX + 7, buttonY + 14);
                if (isPlayerOnePick) {
                    ctx.fillStyle = '#ffd84d';
                    ctx.textAlign = 'center';
                    ctx.fillText('P1', buttonX + (card.width - 18) / 2, buttonY + 14);
                }
                ctx.fillStyle = color;
                ctx.textAlign = 'right';
                ctx.fillText(String(driver.rating), buttonX + card.width - 32, buttonY + 14);
            });
        });

        ctx.fillStyle = '#747f8d';
        ctx.font = '600 11px Arial';
        ctx.textAlign = 'center';
        const footerText = raceMode === 'versus' && versusSelectionPlayer === 1
            ? 'P1のドライバーを選択してください'
            : raceMode === 'versus'
                ? 'P2のドライバーを選択するとレースを開始します'
                : 'ドライバーを選択するとレースを開始します';
        ctx.fillText(footerText, canvas.width / 2, 486);
        ctx.restore();
        return;
    }

    // 背景
    ctx.fillStyle = 'rgba(30, 30, 30, 0.98)'; // 少し濃くして他の画面と区別
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // タイトル
    ctx.fillStyle = 'white';
    ctx.font = 'bold 40px "Formula1 Display Wide", "Arial Black", sans-serif'; // サイズアップ、フォールバック追加
    ctx.textAlign = 'center';
    if (careerPlayerTeamName) {
        ctx.fillText(`SELECT DRIVER FOR ${careerPlayerTeamName.toUpperCase()}`, canvas.width / 2, 50);
    } else {
        ctx.fillText('SELECT YOUR DRIVER', canvas.width / 2, 50);
    }

    // 操作説明
    ctx.font = 'italic 16px Arial';
    ctx.fillStyle = 'grey';
    ctx.textAlign = 'center';
    if (!careerPlayerTeamName) {
        ctx.fillText('Click on a driver name to start the race.', canvas.width / 2, canvas.height - 30);
    } else {
        // careerModeButton.isVisible = false; // キャリアモードでチーム選択後は非表示 (タイトル画面に移動したため不要)
        ctx.fillText(`Click on a driver name to confirm your choice for ${careerPlayerTeamName}.`, canvas.width / 2, canvas.height - 30);
    }
    ctx.textAlign = 'left'; // textAlignをリセット


    // --- 3列レイアウトのための設定 ---
    const teams = careerPlayerTeamName ? [careerPlayerTeamName] : Object.keys(driverLineups);
    const numTeams = teams.length;
    const numColumns = careerPlayerTeamName ? 1 : 4; // キャリアモードでチーム選択済みの場合は1列
    const columnWidth = careerPlayerTeamName ? canvas.width : canvas.width / numColumns; // 1列の場合は全幅
    const horizontalPadding = 20; // 各列内の左右のパディング (元に戻すか調整)
    // const machineImageDisplayWidth = CAR_WIDTH * 0.5; // マシン画像削除のため不要
    // const machineImageDisplayHeight = CAR_HEIGHT * 0.5; // マシン画像削除のため不要
    // const spaceAfterMachineImage = 10; // マシン画像削除のため不要

    let startYForRow = 100; // 最初の行の開始Y座標 (少し上に調整)
    const itemHeight = 30;  // 各行の高さ
    const driverTextSize = 20; // ドライバー名のフォントサイズ
    const teamNameHeight = itemHeight; // チーム名表示行の高さ (itemHeightと同じでよい)
    const driverNameIndent = 10;    // チーム名からのドライバー名のインデント
    const teamBlockPaddingY = 40;   // チームブロックの行間の縦のスペース

    let currentTeamIndex = 0;
    while (currentTeamIndex < numTeams) {
        let maxDriversInCurrentRow = 0;
        let teamsToDrawInRow = [];

        // 現在の行に表示するチームを収集 (最大3チーム)
        for (let col = 0; col < numColumns && currentTeamIndex < numTeams; col++) { // numTeams を使用
            const teamName = teams[currentTeamIndex];
            teamsToDrawInRow.push({
                name: teamName,
                drivers: driverLineups[teamName].drivers,
                image: driverLineups[teamName].image, // チーム画像
                colIndex: col
            });
            maxDriversInCurrentRow = Math.max(maxDriversInCurrentRow, driverLineups[teamName].drivers.length);
            currentTeamIndex++;
        }

        // 収集したチームを描画
        teamsToDrawInRow.forEach(teamData => {
            let teamDisplayX = teamData.colIndex * columnWidth + horizontalPadding;
            if (careerPlayerTeamName) { // キャリアモードでチーム選択済みの場合、中央に表示
                // チーム名やドライバー名が描画される領域の開始Xを調整
                teamDisplayX = canvas.width / 2 - 150; // 仮の中央寄せ（テキスト幅に応じて調整が必要）
            }
            let currentYForTeamContent = startYForRow;

            // チーム名
            ctx.font = `bold ${driverTextSize + 4}px "Formula1 Display Regular", "Arial Black", sans-serif`; // サイズアップ、フォールバック追加
            ctx.fillStyle = '#e0e0e0'; // チーム名は薄いグレー
            ctx.textAlign = 'left';
            ctx.fillText(teamData.name.toUpperCase(), teamDisplayX, currentYForTeamContent); // 既に大文字
            currentYForTeamContent += teamNameHeight; // チーム名の下へ

            // マシン画像の描画ロジックを削除
            // currentYForTeamContent の調整もマシン画像分は不要になる

            // ドライバー名
            teamData.drivers.forEach((driver) => {
                ctx.font = `bold ${driverTextSize}px "Formula1 Display Regular", Arial, sans-serif`; // boldを追加、フォールバックはArialのまま
                ctx.fillStyle = 'white'; // ドライバー名は白
                // driver オブジェクトや driver.name が null または undefined の場合にエラーが発生するのを防ぐため、
                // 安全にアクセスし、フォールバックテキスト "N/A" を使用します。
                const driverNameText = (driver && driver.name) ? driver.name : "N/A";
                ctx.fillText(` • ${driverNameText}`, teamDisplayX + driverNameIndent * 2, currentYForTeamContent);
                currentYForTeamContent += itemHeight;
            });
        });
        // 次の行の開始Y座標を更新
        // マシン画像の高さを除外
        startYForRow += teamNameHeight + (maxDriversInCurrentRow * itemHeight) + teamBlockPaddingY;
    }
    ctx.restore();
}

// ====== タイトル画面描画関数 ======
function drawTitleScreen() {
    ctx.save();

    // === タイトル画面用のコース描画 ===
    // cameraOffsetX と ZOOM_LEVEL をタイトル画面用に設定
    const titleZoomLevel = 1.0;     const titleCameraOffsetX = (canvas.width / 2) - (canvas.width / 2 / titleZoomLevel);

    ctx.scale(titleZoomLevel, titleZoomLevel);
    ctx.translate(-titleCameraOffsetX, -titleScreenCameraOffsetY); // Yオフセットは更新される変数を使用

    // `draw` 関数からコース描画ロジックを移植 (必要な部分のみ)
    const visibleTop = titleScreenCameraOffsetY;
    const visibleBottom = titleScreenCameraOffsetY + canvas.height / titleZoomLevel;
    const segmentHeight = canvas.height / titleZoomLevel;
    const startSegmentY = Math.floor(visibleTop / segmentHeight) * segmentHeight - segmentHeight;

    const RUN_OFF_WIDTH = 400; // コース脇の幅
    const KERB_BLOCK_LENGTH = 40;

    // グラデーションの作成 (コース脇)
    const trackLeftEdgeX = canvas.width / 2 - TRACK_WIDTH / 2;
    const trackRightEdgeX = canvas.width / 2 + TRACK_WIDTH / 2;

    const leftGradient = ctx.createLinearGradient(trackLeftEdgeX - RUN_OFF_WIDTH, 0, trackLeftEdgeX, 0);
    leftGradient.addColorStop(0, BACKGROUND_COLOR);
    leftGradient.addColorStop(1, OFF_TRACK_COLOR);

    const rightGradient = ctx.createLinearGradient(trackRightEdgeX, 0, trackRightEdgeX + RUN_OFF_WIDTH, 0);
    rightGradient.addColorStop(0, OFF_TRACK_COLOR);
    rightGradient.addColorStop(1, BACKGROUND_COLOR);

    for (let y = startSegmentY; y < visibleBottom + segmentHeight; y += segmentHeight) {
        // 背景色 (さらに外側)
        ctx.fillStyle = BACKGROUND_COLOR;
        ctx.fillRect(titleCameraOffsetX, y, canvas.width / titleZoomLevel, segmentHeight);

        // コース脇 (トラックの左右) - グラデーション適用
        ctx.fillStyle = leftGradient;
        ctx.fillRect(trackLeftEdgeX - RUN_OFF_WIDTH, y, RUN_OFF_WIDTH, segmentHeight);
        
        ctx.fillStyle = rightGradient;
        ctx.fillRect(trackRightEdgeX, y, RUN_OFF_WIDTH, segmentHeight);

        // 路面 (灰色)
        ctx.fillStyle = TRACK_COLOR;
        ctx.fillRect(trackLeftEdgeX, y, TRACK_WIDTH, segmentHeight);

        // 白線 (中央線)
        ctx.fillStyle = 'white';
        ctx.fillRect(canvas.width / 2 - 2, y, 4, segmentHeight);

        // 白線 (路肩線)
        ctx.fillRect(trackLeftEdgeX - 2, y, 4, segmentHeight);
        ctx.fillRect(trackRightEdgeX - 2, y, 4, segmentHeight);

        // 縁石
        if (IS_NIGHT_RACE) {
            ctx.shadowBlur = KERB_GLOW_BLUR;
            ctx.shadowColor = KERB_GLOW_COLOR;
        }
        for (let kerbY = 0; kerbY < segmentHeight; kerbY += KERB_BLOCK_LENGTH) {
            ctx.fillStyle = KERB_COLORS[Math.floor(kerbY / KERB_BLOCK_LENGTH) % KERB_COLORS.length];
            const currentBlockLength = Math.min(KERB_BLOCK_LENGTH, segmentHeight - kerbY);
            ctx.fillRect(trackLeftEdgeX, y + kerbY, KERB_WIDTH, currentBlockLength);
            ctx.fillRect(trackRightEdgeX - KERB_WIDTH, y + kerbY, KERB_WIDTH, currentBlockLength);
        }
        ctx.shadowBlur = 0;
    }
    // === コース描画ここまで ===

    ctx.restore(); // カメラ変形を元に戻す
    ctx.save();    // UI描画用に再度保存

    // タイトル画面のUI要素
    const titleShade = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    titleShade.addColorStop(0, 'rgba(4, 7, 11, 0.90)');
    titleShade.addColorStop(0.62, 'rgba(4, 7, 11, 0.67)');
    titleShade.addColorStop(1, 'rgba(4, 7, 11, 0.91)');
    ctx.fillStyle = titleShade;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ff4d00';
    ctx.fillRect(canvas.width / 2 - 30, 96, 60, 5);
    ctx.fillStyle = 'white';
    ctx.font = 'italic 900 58px "Arial Black", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FORMULA STRAIGHT', canvas.width / 2, 170);
    ctx.fillStyle = '#a4adba';
    ctx.font = '700 13px Arial';
    ctx.fillText('20 DRIVERS  •  ONE STRAIGHT  •  FLAT OUT', canvas.width / 2, 199);

    // クイックレースボタン
    quickRaceButton.isVisible = true;
    quickRaceButton.width = 280;
    quickRaceButton.height = 58;
    quickRaceButton.x = canvas.width / 2 - 140;
    quickRaceButton.y = 226;
    const quickRaceHovered = currentMouseX >= quickRaceButton.x && currentMouseX <= quickRaceButton.x + quickRaceButton.width &&
        currentMouseY >= quickRaceButton.y && currentMouseY <= quickRaceButton.y + quickRaceButton.height;
    ctx.fillStyle = quickRaceHovered ? '#ff6a27' : '#ff4d00';
    ctx.beginPath();
    ctx.roundRect(quickRaceButton.x, quickRaceButton.y, quickRaceButton.width, quickRaceButton.height, 7);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = '900 21px Arial';
    ctx.fillText('QUICK RACE', canvas.width / 2, quickRaceButton.y + 27);
    ctx.font = '700 10px Arial';
    ctx.fillStyle = '#ffe0d3';
    ctx.fillText('SELECT YOUR MACHINE →', canvas.width / 2, quickRaceButton.y + 47);

    twoPlayerRaceButton.isVisible = true;
    twoPlayerRaceButton.x = canvas.width / 2 - twoPlayerRaceButton.width / 2;
    twoPlayerRaceButton.y = 300;
    const twoPlayerHovered = currentMouseX >= twoPlayerRaceButton.x && currentMouseX <= twoPlayerRaceButton.x + twoPlayerRaceButton.width &&
        currentMouseY >= twoPlayerRaceButton.y && currentMouseY <= twoPlayerRaceButton.y + twoPlayerRaceButton.height;
    ctx.fillStyle = twoPlayerHovered ? '#354151' : '#222a35';
    ctx.strokeStyle = '#4c596a';
    ctx.beginPath();
    ctx.roundRect(twoPlayerRaceButton.x, twoPlayerRaceButton.y, twoPlayerRaceButton.width, twoPlayerRaceButton.height, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 19px Arial';
    ctx.fillText('MULTIPLAYER', canvas.width / 2, twoPlayerRaceButton.y + 25);
    ctx.fillStyle = '#9ca7b5';
    ctx.font = '700 10px Arial';
    ctx.fillText('2–4 PLAYERS  •  LOCAL SPLIT SCREEN', canvas.width / 2, twoPlayerRaceButton.y + 44);

    cpuSettingButton.isVisible = false;

    aiModeSettingButton.isVisible = true;
    aiModeSettingButton.x = 20;
    aiModeSettingButton.y = 18;
    const aiModeHovered = currentMouseX >= aiModeSettingButton.x && currentMouseX <= aiModeSettingButton.x + aiModeSettingButton.width &&
        currentMouseY >= aiModeSettingButton.y && currentMouseY <= aiModeSettingButton.y + aiModeSettingButton.height;
    const isRealAiMode = aiDrivingMode === 'real';
    ctx.fillStyle = aiModeHovered ? '#293440' : 'rgba(18, 24, 31, 0.9)';
    ctx.strokeStyle = isRealAiMode ? '#ff7043' : '#5ecbff';
    ctx.beginPath();
    ctx.roundRect(aiModeSettingButton.x, aiModeSettingButton.y, aiModeSettingButton.width, aiModeSettingButton.height, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = isRealAiMode ? '#ff9a78' : '#8cddff';
    ctx.font = '800 11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`AI  ${isRealAiMode ? 'REAL (HARD)' : 'EASY'}`, aiModeSettingButton.x + aiModeSettingButton.width / 2, aiModeSettingButton.y + 23);

    drsSettingButton.isVisible = true;
    drsSettingButton.x = canvas.width - drsSettingButton.width - 20;
    drsSettingButton.y = 18;
    const drsSettingHovered = currentMouseX >= drsSettingButton.x && currentMouseX <= drsSettingButton.x + drsSettingButton.width &&
        currentMouseY >= drsSettingButton.y && currentMouseY <= drsSettingButton.y + drsSettingButton.height;
    ctx.fillStyle = drsSettingHovered ? '#293440' : 'rgba(18, 24, 31, 0.9)';
    ctx.strokeStyle = drsEnabled ? '#29d9ff' : '#596370';
    ctx.beginPath();
    ctx.roundRect(drsSettingButton.x, drsSettingButton.y, drsSettingButton.width, drsSettingButton.height, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = drsEnabled ? '#7de9ff' : '#8b95a1';
    ctx.font = '800 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`DRS  ${drsEnabled ? 'ON' : 'OFF'}`, drsSettingButton.x + drsSettingButton.width / 2, drsSettingButton.y + 23);

    courseSettingButton.isVisible = true;
    courseSettingButton.x = canvas.width - courseSettingButton.width - 20;
    courseSettingButton.y = 62;
    const courseHovered = currentMouseX >= courseSettingButton.x && currentMouseX <= courseSettingButton.x + courseSettingButton.width &&
        currentMouseY >= courseSettingButton.y && currentMouseY <= courseSettingButton.y + courseSettingButton.height;
    ctx.fillStyle = courseHovered ? '#293440' : 'rgba(18, 24, 31, 0.9)';
    ctx.strokeStyle = '#596370';
    ctx.beginPath();
    ctx.roundRect(courseSettingButton.x, courseSettingButton.y, courseSettingButton.width, courseSettingButton.height, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 11px Arial';
    ctx.fillText(`COURSE  ${SEASON_SCHEDULE[selectedQuickRaceCourseIndex].name.toUpperCase()}  ›`, courseSettingButton.x + courseSettingButton.width / 2, courseSettingButton.y + 23);

    careerModeButton.isVisible = false;
    loadGameButton.isVisible = false;
    ctx.fillStyle = '#7f8997';
    ctx.font = '600 12px Arial';
    ctx.fillText('CHOOSE A MODE TO START', canvas.width / 2, 397);

    ctx.textAlign = 'left'; // textAlignをリセット
    ctx.restore();
}

function drawDrsPoint(trackLeftEdgeX, trackRightEdgeX, pointY) {
    ctx.save();
    ctx.fillStyle = 'white';
    ctx.fillRect(trackLeftEdgeX, pointY - 3, trackRightEdgeX - trackLeftEdgeX, 6);
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7de9ff';
    ctx.fillText('DRS 500m', (trackLeftEdgeX + trackRightEdgeX) / 2, pointY - 12);

    // 検知ライン脇のコーン（1本）
    const coneX = trackRightEdgeX - 18;
    ctx.fillStyle = '#ff6a00';
    ctx.beginPath();
    ctx.moveTo(coneX, pointY - 25);
    ctx.lineTo(coneX - 12, pointY + 10);
    ctx.lineTo(coneX + 12, pointY + 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.fillRect(coneX - 8, pointY - 5, 16, 5);
    ctx.restore();
}

function drawVisibleDrsPoints(visibleTop, visibleBottom, trackLeftEdgeX, trackRightEdgeX) {
    const firstIndex = Math.max(1, Math.floor(-visibleBottom / DRS_POINT_SPACING_PX));
    const lastIndex = Math.max(firstIndex, Math.ceil(-visibleTop / DRS_POINT_SPACING_PX));
    for (let index = firstIndex; index <= lastIndex; index++) {
        const pointY = -index * DRS_POINT_SPACING_PX;
        if (pointY >= GOAL_LINE_Y_POSITION && pointY >= visibleTop - 60 && pointY <= visibleBottom + 60) {
            drawDrsPoint(trackLeftEdgeX, trackRightEdgeX, pointY);
        }
    }
}

function drawSplitRaceScreen() {
    const viewports = getMultiplayerViewports();
    const splitZoom = multiplayerPlayerCount === 2 ? 0.76 : 0.52;
    const shake = getCameraShakeOffset();

    const drawViewport = (viewport, focusCarIndex, label, labelColor) => {
        const focusCar = cars[focusCarIndex] || cars[0];
        if (!focusCar) return;
        const cameraX = trackCenterX - viewport.width / (2 * splitZoom);
        const cameraY = focusCar.y + CAR_HEIGHT / 2 - viewport.height * 0.62 / splitZoom;
        const trackLeft = trackCenterX - TRACK_WIDTH / 2;
        const trackRight = trackCenterX + TRACK_WIDTH / 2;

        ctx.save();
        ctx.beginPath();
        ctx.rect(viewport.x, viewport.y, viewport.width, viewport.height);
        ctx.clip();
        ctx.translate(viewport.x + shake.x, viewport.y + shake.y);
        ctx.scale(splitZoom, splitZoom);
        ctx.translate(-cameraX, -cameraY);

        ctx.fillStyle = BACKGROUND_COLOR;
        ctx.fillRect(cameraX, cameraY - 200, viewport.width / splitZoom, viewport.height / splitZoom + 400);
        ctx.fillStyle = OFF_TRACK_COLOR;
        ctx.fillRect(trackLeft - 400, cameraY - 200, TRACK_WIDTH + 800, viewport.height / splitZoom + 400);
        ctx.fillStyle = TRACK_COLOR;
        ctx.fillRect(trackLeft, cameraY - 200, TRACK_WIDTH, viewport.height / splitZoom + 400);
        ctx.fillStyle = 'white';
        ctx.fillRect(trackLeft - 2, cameraY - 200, 4, viewport.height / splitZoom + 400);
        ctx.fillRect(trackRight - 2, cameraY - 200, 4, viewport.height / splitZoom + 400);
        ctx.fillRect(trackCenterX - 2, cameraY - 200, 4, viewport.height / splitZoom + 400);

        const kerbStart = Math.floor((cameraY - 200) / 40) * 40;
        for (let y = kerbStart; y < cameraY + viewport.height / splitZoom + 200; y += 40) {
            ctx.fillStyle = KERB_COLORS[Math.abs(Math.floor(y / 40)) % KERB_COLORS.length];
            ctx.fillRect(trackLeft, y, KERB_WIDTH, 40);
            ctx.fillRect(trackRight - KERB_WIDTH, y, KERB_WIDTH, 40);
        }

        drawTireMarks(cameraY, cameraY + viewport.height / splitZoom);
        drawVisibleDrsPoints(cameraY, cameraY + viewport.height / splitZoom, trackLeft, trackRight);

        if (GOAL_LINE_Y_POSITION >= cameraY - 30 && GOAL_LINE_Y_POSITION <= cameraY + viewport.height / splitZoom + 30) {
            ctx.fillStyle = 'white';
            ctx.fillRect(trackLeft, GOAL_LINE_Y_POSITION, TRACK_WIDTH, GOAL_LINE_THICKNESS);
        }

        cars.forEach((car, index) => {
            if (car.y < cameraY - 100 || car.y > cameraY + viewport.height / splitZoom + 100) return;
            ctx.save();
            ctx.translate(car.x + CAR_WIDTH / 2, car.y + CAR_HEIGHT / 2);
            ctx.rotate(car.angle);
            if (car.image && car.image.complete && car.image.naturalHeight !== 0) {
                ctx.drawImage(car.image, -CAR_WIDTH / 2, -CAR_HEIGHT / 2, CAR_WIDTH, CAR_HEIGHT);
            } else {
                ctx.fillStyle = 'red';
                ctx.fillRect(-CAR_WIDTH / 2, -CAR_HEIGHT / 2, CAR_WIDTH, CAR_HEIGHT);
            }
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            const carPlayerIndex = playerCarIndices.indexOf(index);
            ctx.fillStyle = carPlayerIndex >= 0 ? MULTIPLAYER_COLORS[carPlayerIndex] : 'white';
            if (car.isDrsActive) {
                ctx.shadowColor = '#29d9ff';
                ctx.shadowBlur = 16;
            }
            ctx.fillText(car.driverName, 0, -CAR_HEIGHT / 2 - 6);
            ctx.restore();
        });
        ctx.restore();

        const ranks = [...cars].sort((a, b) => a.y - b.y);
        const rank = ranks.indexOf(focusCar) + 1;
        ctx.fillStyle = 'rgba(5, 8, 12, 0.78)';
        ctx.fillRect(viewport.x + 8, viewport.y + 8, 178, 56);
        ctx.fillStyle = labelColor;
        ctx.font = '900 15px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`${label}  ${getDriverLastName(focusCar)}`, viewport.x + 16, viewport.y + 29);
        ctx.fillStyle = 'white';
        ctx.font = '700 12px Arial';
        ctx.fillText(`P${rank}   ${Math.max(0, focusCar.speed * SPEED_TO_KMH_FACTOR).toFixed(0)} km/h`, viewport.x + 16, viewport.y + 50);
        if (focusCar.isDrsActive) {
            ctx.fillStyle = '#7de9ff';
            ctx.shadowColor = '#29d9ff';
            ctx.shadowBlur = 12;
            ctx.fillText('DRS', viewport.x + 145, viewport.y + 50);
            ctx.shadowBlur = 0;
        }
    };

    viewports.forEach((viewport, player) => {
        drawViewport(viewport, playerCarIndices[player], `P${player + 1}`, MULTIPLAYER_COLORS[player]);
    });

    ctx.fillStyle = '#05070a';
    ctx.fillRect(canvas.width / 2 - 3, 0, 6, canvas.height);
    ctx.fillStyle = '#ff4d00';
    ctx.fillRect(canvas.width / 2 - 1, 0, 2, canvas.height);
    if (multiplayerPlayerCount >= 3) {
        ctx.fillStyle = '#05070a';
        ctx.fillRect(0, canvas.height / 2 - 3, canvas.width, 6);
        ctx.fillStyle = '#ff4d00';
        ctx.fillRect(0, canvas.height / 2 - 1, canvas.width, 2);
    }

    if (gameState === 'signal_sequence') {
        const totalWidth = 5 * 28;
        viewports.forEach(viewport => {
            const centerX = viewport.x + viewport.width / 2;
            const signalY = viewport.y + (viewport.height >= 400 ? 95 : 82);
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                ctx.arc(centerX - totalWidth / 2 + i * 28 + 14, signalY, 10, 0, Math.PI * 2);
                ctx.fillStyle = i < signalLightsOnCount ? '#ff2020' : '#541010';
                ctx.fill();
            }
        });
    }

    if (gameState === 'finished' || gameState === 'all_finished') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(canvas.width / 2 - 145, canvas.height / 2 - 28, 290, 56);
        ctx.fillStyle = 'white';
        ctx.font = '900 22px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(gameState === 'all_finished' ? 'RACE COMPLETE' : 'PLAYERS FINISHED', canvas.width / 2, canvas.height / 2 + 7);
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // キャンバスをクリア

    if (gameState === 'title_screen') {
        drawTitleScreen();
        return; // タイトル画面の描画のみ
    }
    if (gameState === 'multiplayer_setup') {
        drawMultiplayerSetupScreen();
        return;
    }
    if (gameState === 'save_game_selection') {
        drawSaveLoadScreen(true); // true for save mode
        return;
    }
    if (gameState === 'load_game_selection') {
        drawSaveLoadScreen(false); // false for load mode
        return;
    }
    if (gameState === 'driver_selection') {
        drawDriverSelectionScreen();
        return; // ゲームワールドの描画は行わない
    }
    if (gameState === 'career_machine_performance') {
        drawCareerMachinePerformanceScreen();
        return; // マシンパフォーマンス画面はフルスクリーンUIなので、ここで描画を終了
    }
    if (gameState === 'career_team_selection') {
        drawCareerTeamSelectionScreen();
        return; // ゲームワールドの描画は行わない
    }
    if (gameState === 'career_roster') {
        drawCareerRosterScreen();
        return; // ゲームワールドの描画は行わない
    }
    if (gameState === 'career_season_end') {
        drawCareerSeasonEndScreen();
        return; // シーズン終了画面はフルスクリーンUIなので、ここで描画を終了
    }
    if (gameState === 'career_team_standings') {
        drawCareerTeamStandingsScreen();
        return; // チームスタンディング画面はフルスクリーンUI
    }
    if (gameState === 'career_team_offers') {
        drawCareerTeamOffersScreen();
        return; // チームオファー画面はフルスクリーンUI
    }
    if (raceMode === 'versus' && ['signal_sequence', 'race', 'finished'].includes(gameState)) {
        drawSplitRaceScreen();
        return;
    }
    // 上記のいずれかのUI画面が描画された場合は、それぞれのifブロック内でreturnされる。
    // それ以外の場合（レース中など）は、以下のメイン描画ロジックが実行される。

    // カメラのズームとオフセットを適用
    const cameraShake = getCameraShakeOffset();
    ctx.save(); // Save the current state before applying camera transformations
    ctx.scale(ZOOM_LEVEL, ZOOM_LEVEL);
    ctx.translate(-cameraOffsetX + cameraShake.x / ZOOM_LEVEL, -cameraOffsetY + cameraShake.y / ZOOM_LEVEL);

    // === 無限スクロールする直線コースの描画 ===
    const visibleTop = cameraOffsetY;
    const visibleBottom = cameraOffsetY + canvas.height / ZOOM_LEVEL;
    const segmentHeight = canvas.height / ZOOM_LEVEL;
    const startSegmentY = Math.floor(visibleTop / segmentHeight) * segmentHeight - segmentHeight;

    // 縁石の設定
    const KERB_BLOCK_LENGTH = 40; // 縁石の各ブロックの長さ
    const RUN_OFF_WIDTH = 400; // コース脇の幅

    // グラデーションの作成 (コース脇)
    const trackLeftEdgeX = canvas.width / 2 - TRACK_WIDTH / 2;
    const trackRightEdgeX = canvas.width / 2 + TRACK_WIDTH / 2;

    const leftGradient = ctx.createLinearGradient(trackLeftEdgeX - RUN_OFF_WIDTH, 0, trackLeftEdgeX, 0);
    leftGradient.addColorStop(0, BACKGROUND_COLOR);
    leftGradient.addColorStop(1, OFF_TRACK_COLOR);

    const rightGradient = ctx.createLinearGradient(trackRightEdgeX, 0, trackRightEdgeX + RUN_OFF_WIDTH, 0);
    rightGradient.addColorStop(0, OFF_TRACK_COLOR);
    rightGradient.addColorStop(1, BACKGROUND_COLOR);

    for (let y = startSegmentY; y < visibleBottom + segmentHeight; y += segmentHeight) {
        // 背景色 (さらに外側) - 画面幅全体に描画
        ctx.fillStyle = BACKGROUND_COLOR;
        ctx.fillRect(cameraOffsetX, y, canvas.width / ZOOM_LEVEL, segmentHeight);

        // コース脇 (トラックの左右) - グラデーション適用
        ctx.fillStyle = leftGradient;
        ctx.fillRect(trackLeftEdgeX - RUN_OFF_WIDTH, y, RUN_OFF_WIDTH, segmentHeight);
        
        ctx.fillStyle = rightGradient;
        ctx.fillRect(trackRightEdgeX, y, RUN_OFF_WIDTH, segmentHeight);

        // 路面 (灰色) - 中央部分
        ctx.fillStyle = TRACK_COLOR;
        ctx.fillRect(trackLeftEdgeX, y, TRACK_WIDTH, segmentHeight);

        // 白線 (中央線)
        ctx.fillStyle = 'white';
        ctx.fillRect(canvas.width / 2 - 2, y, 4, segmentHeight); // 中央線を実線として描画

        // 白線 (路肩線)
        // ctx.fillStyle = 'white'; // 既に設定済み

        ctx.fillRect(trackLeftEdgeX - 2, y, 4, segmentHeight); // 左側の白線
        ctx.fillRect(trackRightEdgeX - 2, y, 4, segmentHeight); // 右側の白線

        // 縁石の描画 (路肩線の内側、路面の上)
        if (IS_NIGHT_RACE) {
            ctx.shadowBlur = KERB_GLOW_BLUR;
            ctx.shadowColor = KERB_GLOW_COLOR;
        }
        // 左側の縁石
        for (let kerbY = 0; kerbY < segmentHeight; kerbY += KERB_BLOCK_LENGTH) {
            ctx.fillStyle = KERB_COLORS[Math.floor(kerbY / KERB_BLOCK_LENGTH) % KERB_COLORS.length];
            const currentBlockLength = Math.min(KERB_BLOCK_LENGTH, segmentHeight - kerbY);
            ctx.fillRect(trackLeftEdgeX, y + kerbY, KERB_WIDTH, currentBlockLength);
        }
        // 右側の縁石
        for (let kerbY = 0; kerbY < segmentHeight; kerbY += KERB_BLOCK_LENGTH) {
            ctx.fillStyle = KERB_COLORS[Math.floor(kerbY / KERB_BLOCK_LENGTH) % KERB_COLORS.length];
            const currentBlockLength = Math.min(KERB_BLOCK_LENGTH, segmentHeight - kerbY);
            ctx.fillRect(trackRightEdgeX - KERB_WIDTH, y + kerbY, KERB_WIDTH, currentBlockLength);
        }
        ctx.shadowBlur = 0;
    }

    drawTireMarks(cameraOffsetY, cameraOffsetY + canvas.height / ZOOM_LEVEL);
    drawVisibleDrsPoints(cameraOffsetY, cameraOffsetY + canvas.height / ZOOM_LEVEL, trackLeftEdgeX, trackRightEdgeX);

    // === ゴールラインの描画 ===
    if (GOAL_LINE_Y_POSITION > cameraOffsetY - GOAL_LINE_THICKNESS && GOAL_LINE_Y_POSITION < cameraOffsetY + canvas.height / ZOOM_LEVEL) {
        const squareSize = 20;
        const numSquares = Math.ceil(TRACK_WIDTH / squareSize);
        for (let i = 0; i < numSquares; i++) {
            ctx.fillStyle = (i % 2 === 0) ? 'white' : 'black';
            const x = (canvas.width / 2 - TRACK_WIDTH / 2) + i * squareSize;
            const width = (i === numSquares - 1) ? TRACK_WIDTH - i * squareSize : squareSize; // 最後の四角の幅調整
            ctx.fillRect(x, GOAL_LINE_Y_POSITION, width, GOAL_LINE_THICKNESS);
        }
         // ゴールラインの上下に少し太い白線を追加して目立たせる (任意)
        ctx.fillStyle = 'white';
        ctx.fillRect(canvas.width / 2 - TRACK_WIDTH / 2 - 5, GOAL_LINE_Y_POSITION - 5, TRACK_WIDTH + 10, 5);
        ctx.fillRect(canvas.width / 2 - TRACK_WIDTH / 2 - 5, GOAL_LINE_Y_POSITION + GOAL_LINE_THICKNESS, TRACK_WIDTH + 10, 5);

        ctx.font = 'bold 30px Arial';
        ctx.fillStyle = 'yellow';
        ctx.textAlign = 'center';
        ctx.fillText('FINISH', canvas.width / 2, GOAL_LINE_Y_POSITION - 15);
        ctx.textAlign = 'left'; // 他の描画のためにtextAlignを戻す
    }

    // 全ての車の描画
    cars.forEach(car => {
        // 画像がロードされているか確認
        if (car.image && car.image.complete && car.image.naturalHeight !== 0) {
            ctx.save();
            // 回転軸を車の中心に設定
            ctx.translate(car.x + CAR_WIDTH / 2, car.y + CAR_HEIGHT / 2);

            // car.angleに合わせて回転させて描画します。
            ctx.rotate(car.angle);

            ctx.drawImage(car.image, -CAR_WIDTH / 2, -CAR_HEIGHT / 2, CAR_WIDTH, CAR_HEIGHT);

            // ドライバー名の描画 (レース中とリプレイ中)
            if (gameState === 'signal_sequence' || gameState === 'race' || gameState === 'finished' || gameState === 'all_finished' || gameState === 'replay') {
                ctx.font = 'bold 16px Arial'; // フォントサイズを12pxに変更
                // プレイヤーの車は黄色、AIカーは白で表示
                const originalIndex = cars.findIndex(c => c === car); // cars配列内での元のインデックスを取得
                const localPlayerIndex = playerCarIndices.indexOf(originalIndex);
                ctx.fillStyle = localPlayerIndex >= 0 ? MULTIPLAYER_COLORS[localPlayerIndex] : 'white';
                ctx.textAlign = 'center';
                // マシンの上中央に名前を表示 (Y座標を調整して画像の上に配置)
                ctx.fillText(car.driverName, 0, -CAR_HEIGHT / 2 - 5); // car.driverName は3文字表記になっている想定
            }

        // スリップストリーム中のインジケーター (名前を緑色にする)
        if (car.isInSlipstream && (gameState === 'race' || gameState === 'replay')) {
            ctx.fillStyle = 'lime'; // 緑色
            ctx.fillText(car.driverName, 0, -CAR_HEIGHT / 2 - 5);
        }
        if (car.isDrsActive && gameState === 'race') {
            ctx.shadowColor = '#29d9ff';
            ctx.shadowBlur = 14;
            ctx.fillText(car.driverName, 0, -CAR_HEIGHT / 2 - 5);
            ctx.shadowBlur = 0;
        }
            ctx.restore();
        } else {
            // 画像がロードされていない場合、一時的に四角を描画
            ctx.fillStyle = 'red';
            ctx.fillRect(car.x, car.y, CAR_WIDTH, CAR_HEIGHT);
        }
    });

    ctx.restore(); // ズームとオフセットの描画状態を元に戻す

    // === スタートシグナルの描画 (HUDとして) ===
    function drawSignalLightsUI() {
        // リプレイ中や全車ゴール後は表示しない
        if (gameState === 'loading' || gameState === 'finished' || gameState === 'all_finished' || gameState === 'replay' || signalLightsOnCount > SIGNAL_NUM_LIGHTS) {
            return;
        }

        const lightRadius = 15;
        const lightSpacing = 10;
        const totalWidth = SIGNAL_NUM_LIGHTS * (2 * lightRadius + lightSpacing) - lightSpacing;
        let startX = canvas.width / 2 - totalWidth / 2;
        const lightY = 40;

        for (let i = 0; i < SIGNAL_NUM_LIGHTS; i++) {
            ctx.beginPath();
            ctx.arc(startX + i * (2 * lightRadius + lightSpacing) + lightRadius, lightY, lightRadius, 0, Math.PI * 2);
            if (gameState === 'signal_sequence' && i < signalLightsOnCount) {
                ctx.fillStyle = 'red'; // 点灯
            } else if (gameState === 'race' && signalLightsOnCount === -1) { // レース開始直後（全消灯）
                ctx.fillStyle = 'darkgrey'; // 消灯
            } else {
                ctx.fillStyle = 'darkred'; // 消灯 (またはシーケンス中の未点灯)
            }
            ctx.fill();
            ctx.strokeStyle = 'black';
            ctx.stroke();
        }
    }
    drawSignalLightsUI();

    // デバッグ情報 (ズームとオフセットの影響を受けないように、restore()後に描画)
    let playerCarForDebug = null;
    if (cars && cars.length > 0 && playerCarIndex >= 0 && playerCarIndex < cars.length) {
        playerCarForDebug = cars[playerCarIndex];
    }

    // 開発用テレメトリーは通常プレイでは非表示にして、HUDの視認性を優先する。
    if (false) {
    const debugLineHeight = 18;
    const debugPadding = 10;
    const debugInfoX = canvas.width - 230; // 右端からのX座標
    const debugInfoStartY = canvas.height - (7 * debugLineHeight) - debugPadding; // 下端からのY座標

    ctx.fillStyle = 'black';
    ctx.font = '14px Arial'; // フォントサイズを少し調整

    if (playerCarForDebug) {
        ctx.fillText(`Angle: ${(playerCarForDebug.angle * 180 / Math.PI).toFixed(2)}`, debugInfoX, debugInfoStartY);
        ctx.fillText(`Car X: ${playerCarForDebug.x.toFixed(2)}`, debugInfoX, debugInfoStartY + debugLineHeight);
        ctx.fillText(`Car Y: ${playerCarForDebug.y.toFixed(2)}`, debugInfoX, debugInfoStartY + debugLineHeight * 2);
        ctx.fillText(`Player Driver: ${playerCarForDebug.driverName}`, debugInfoX, debugInfoStartY + debugLineHeight * 6);
    } else {
        ctx.fillText(`Angle: N/A`, debugInfoX, debugInfoStartY);
        ctx.fillText(`Car X: N/A`, debugInfoX, debugInfoStartY + debugLineHeight);
        ctx.fillText(`Car Y: N/A`, debugInfoX, debugInfoStartY + debugLineHeight * 2);
        ctx.fillText(`Player Driver: N/A`, debugInfoX, debugInfoStartY + debugLineHeight * 6);
    }
    ctx.fillText(`Cam X (world): ${cameraOffsetX.toFixed(2)}`, debugInfoX, debugInfoStartY + debugLineHeight * 3);
    ctx.fillText(`Cam Y (world): ${cameraOffsetY.toFixed(2)}`, debugInfoX, debugInfoStartY + debugLineHeight * 4);
    ctx.fillText(`Zoom: ${ZOOM_LEVEL.toFixed(1)}`, debugInfoX, debugInfoStartY + debugLineHeight * 5);

    // Player Y-coordinate display (bottom right)
    if (playerCarForDebug) {
        const playerYText = `Player Y: ${playerCarForDebug.y.toFixed(2)}`;
        ctx.font = '16px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'right';
        ctx.fillText(playerYText, canvas.width - debugPadding, canvas.height - debugPadding);
        ctx.textAlign = 'left'; // Reset alignment
    }
    }
    // === 順位表の描画 (HUDとして) ===
    function drawRankingsUI() {
        // レース中またはシグナル中のみ表示。終了後は最終リザルトを表示するためここでは描画しない
        if (gameState !== 'race' && gameState !== 'signal_sequence') return;

        const rankingBoxX = 10;
        const headerLineHeight = 22;
        const rankingBoxY = 30 + headerLineHeight; // ヘッダー表示分下にずらす
        const lineHeight = 18;
        const padding = 10; // パディングを少し増やす

        // === シーズン/レース情報ヘッダー ===
        ctx.font = 'bold 16px "Formula1 Display Wide", Arial, sans-serif';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'left';
        if (careerPlayerTeamName !== null) { // キャリアモードの場合のみシーズン/レース情報を表示
            const raceInfoText = `SEASON ${currentSeasonNumber} - RACE ${currentRaceInSeason}/${RACES_PER_SEASON} (${currentRaceType.name.toUpperCase()})`;
            ctx.fillText(raceInfoText, rankingBoxX, rankingBoxY - lineHeight / 2 - padding + 2); // 位置調整
        } else { // クイックレースの場合
            ctx.fillText(raceMode === 'versus' ? "MULTIPLAYER" : "QUICK RACE", rankingBoxX, rankingBoxY - lineHeight / 2 - padding + 2);
        }
        // === ヘッダーここまで ===

        const rankedCarsForUI = [...cars]
            .map((car, originalIndex) => ({
                y: car.y,
                driverName: car.driverName,
                startingGridRank: car.startingGridRank, // 順位変動表示は削除するが、データとしては残しても良い
                localPlayerIndex: playerCarIndices.indexOf(originalIndex),
                originalIndex: originalIndex,
                speed: car.speed,
                car
            }))
            .sort((a, b) => a.y - b.y); // y座標でソート


        ctx.font = 'bold 14px Verdana'; // フォントサイズを少し小さく
        const visibleRanks = rankedCarsForUI.length; // 全車表示

        // 枠と背景の描画
    const boxWidth = 240; // 枠の幅 (インターバル表示スペースを考慮)
        const boxHeight = visibleRanks * lineHeight + padding * 1.5; // 高さをパディング分調整
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; // 少し濃い背景
        ctx.fillRect(rankingBoxX - padding, rankingBoxY - lineHeight, boxWidth, boxHeight); // Y開始位置調整
        ctx.strokeStyle = 'rgba(200,200,200,0.7)'; // 枠の色を少し明るく
        ctx.lineWidth = 2;
        ctx.strokeRect(rankingBoxX - padding, rankingBoxY - lineHeight + padding / 2, boxWidth, boxHeight);
        ctx.textAlign = 'left'; // デフォルトのtextAlign

        for (let i = 0; i < visibleRanks; i++) {
            const rankData = rankedCarsForUI[i];
            const currentActualRank = i + 1; // ソート後のインデックスが現在の順位
            // let rankChangeIndicator = ""; // 順位変動表示は削除

            let intervalText = "";
            let displayNameInRanking = rankData.driverName; // デフォルトは既存のdriverName
            // fullName からラストネームを抽出して大文字に
            const carObject = cars.find(c => c.driverName === rankData.driverName);
            if (carObject && carObject.fullName) {
                const nameParts = carObject.fullName.split(' ');
                displayNameInRanking = nameParts.length > 1 ? nameParts.slice(1).join(' ').toUpperCase() : carObject.fullName.toUpperCase();
            }

            if (gameState === 'signal_sequence') {
                if (i === 0) { // 1位
                    intervalText = " Leader";
                } else { // 2位以降
                    intervalText = " +0.0s"; // スタート前は0.0s表示
                }
            } else { // gameState === 'race'
                if (i > 0) { // 2位以降の車
                    const previousCarData = rankedCarsForUI[i-1];
                    const checkpointIndex = rankData.car.lastTimingCheckpointIndex || 0;
                    const carPassTime = rankData.car.timingCheckpointTimes?.[checkpointIndex];
                    const previousCarPassTime = previousCarData.car.timingCheckpointTimes?.[checkpointIndex];
                    if (checkpointIndex > 0 && Number.isFinite(carPassTime) && Number.isFinite(previousCarPassTime)) {
                        const timeIntervalSeconds = Math.abs(carPassTime - previousCarPassTime) / 1000;
                        intervalText = ` +${timeIntervalSeconds.toFixed(1)}s`;
                    } else {
                        intervalText = " +0.0s";
                    }
                } else {
                    // 1位の車
                    intervalText = " Leader";
                }
            }

            // ドライバー名を描画 (左寄せ)
            const driverNameText = `${currentActualRank}. ${displayNameInRanking}`;
            ctx.fillStyle = rankData.localPlayerIndex >= 0 ? MULTIPLAYER_COLORS[rankData.localPlayerIndex] : 'white';
            ctx.fillText(driverNameText, rankingBoxX, rankingBoxY + i * lineHeight);

            // インターバルテキストを描画 (右寄せ)
            ctx.textAlign = 'right';
            ctx.fillText(intervalText, rankingBoxX + boxWidth - padding * 2, rankingBoxY + i * lineHeight); // 右端からpadding分離して描画
            ctx.textAlign = 'left'; // textAlignを元に戻す

        }
    }
    drawRankingsUI();

    // === 最終リザルトの描画 ===
    function drawFinalResultsUI() {
        if (gameState !== 'finished' && gameState !== 'all_finished' && gameState !== 'replay') return; // リプレイ中も表示

        const resultsBoxX = 10;
        const resultsBoxY = 30; // 順位表と同じ位置から開始
        const lineHeight = 18;
        const padding = 5;
        ctx.font = 'bold 14px Verdana';

        const finishedCarsSorted = cars.filter(car => car.hasFinished).sort((a, b) => a.finalRank - b.finalRank);
        if (finishedCarsSorted.length === 0) return;

        const winnerTime = finishedCarsSorted[0].finishTime;

        const boxWidth = 280; // タイム差表示のため少し幅を広げる
        const boxHeight = Math.min(finishedCarsSorted.length, NUM_CARS) * lineHeight + padding; // 全車表示

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(resultsBoxX - padding, resultsBoxY - lineHeight + padding / 2, boxWidth, boxHeight);
        ctx.strokeStyle = 'white'; // 枠の色を白に変更
        ctx.lineWidth = 2;
        ctx.strokeRect(resultsBoxX - padding, resultsBoxY - lineHeight + padding / 2, boxWidth, boxHeight);

        for (let i = 0; i < finishedCarsSorted.length; i++) {
            const carData = finishedCarsSorted[i];
            let timeDiffText = "";
            if (i > 0) { // 2位以降
                const diff = (carData.finishTime - winnerTime) / 1000; // 秒単位に変換
                timeDiffText = ` +${diff.toFixed(3)}s`;
            } else {
                timeDiffText = " (Winner)";
            }
            // 最終リザルトでも名前を大文字のラストネームに
            let displayNameInResults = carData.driverName;
            if (carData.fullName) {
                const nameParts = carData.fullName.split(' ');
                displayNameInResults = nameParts.length > 1 ? nameParts.slice(1).join(' ').toUpperCase() : carData.fullName.toUpperCase();
            }

            const resultText = `${carData.finalRank}. ${displayNameInResults}${timeDiffText}`;
            // 最終リザルトではプレイヤーのインデックスを直接参照できないため、driverNameで比較するか、
            // carオブジェクトにisPlayerフラグを持たせるなどの対応が必要。
            // ここでは、cars配列のplayerCarIndexを使って元のオブジェクトのisPlayerを判定する。
            // const originalCarObject = cars[playerCarIndex]; // これはプレイヤーオブジェクト
            // finishedCarsSortedの各要素が元のcars配列のどの車に対応するかを見つける必要がある
            // 簡単のため、ここではdriverNameで比較する（同名ドライバーがいない前提）
            // より堅牢なのは、各車にユニークIDを持たせるか、mapでisPlayer情報を渡すこと
            let isPlayerCarInResult = (carData.driverName === cars[playerCarIndex].driverName);


            ctx.fillStyle = isPlayerCarInResult ? 'yellow' : 'white';
            ctx.fillText(resultText, resultsBoxX, resultsBoxY + i * lineHeight);
        }
    }
    drawFinalResultsUI();

    // レース終了メッセージ
    if (gameState === 'finished' || gameState === 'all_finished') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(canvas.width / 2 - 200, canvas.height / 2 - 50, 400, 100); // ボックスを少し大きく
        ctx.font = 'bold 40px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(gameState === 'all_finished' ? 'All Cars Finished!' : 'Race Finished!', canvas.width / 2, canvas.height / 2 - 10);
        // プレイヤーの最終順位はリザルト表に含まれるため、個別の表示は削除
        ctx.textAlign = 'left';
    }

    // === キャンバス内ズームスライダーの描画 ===
    // スライダーの位置を計算 (canvasサイズに依存するため、draw内で毎回計算)
    sliderTrackX = canvas.width - SLIDER_MARGIN_RIGHT - SLIDER_TRACK_WIDTH;
    sliderTrackY = SLIDER_MARGIN_TOP; // calculateInitialZoomLevelで中央になるよう設定済み

    // トラックの描画
    ctx.fillStyle = 'rgba(50, 50, 50, 0.7)';
    ctx.fillRect(sliderTrackX, sliderTrackY, SLIDER_TRACK_WIDTH, SLIDER_TRACK_HEIGHT);

    // つまみのY座標を計算
    // (SLIDER_TRACK_HEIGHT - SLIDER_THUMB_HEIGHT) は、つまみがトラック内で動ける最大範囲
    const thumbPositionRatio = (ZOOM_LEVEL - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM);
    const thumbY = sliderTrackY + thumbPositionRatio * (SLIDER_TRACK_HEIGHT - SLIDER_THUMB_HEIGHT);
    const thumbX = sliderTrackX + (SLIDER_TRACK_WIDTH / 2) - (SLIDER_THUMB_WIDTH / 2); // つまみをトラックの中央に配置

    // つまみの描画
    ctx.fillStyle = 'rgba(79, 79, 79, 0.9)';
    ctx.fillRect(thumbX, thumbY, SLIDER_THUMB_WIDTH, SLIDER_THUMB_HEIGHT);
    ctx.strokeStyle = 'rgba(79, 79, 79, 1)';
    ctx.strokeRect(thumbX, thumbY, SLIDER_THUMB_WIDTH, SLIDER_THUMB_HEIGHT);

    // ズーム値のテキスト描画
    ctx.fillStyle = 'black';
    ctx.font = '14px Arial';
    ctx.fillText(`${ZOOM_LEVEL.toFixed(1)}x`, sliderTrackX - 35, sliderTrackY + SLIDER_TRACK_HEIGHT / 2 + 5);


    // === スピードモニターの描画 (左下) ===
    // スピードモニターは、レース関連のステートでのみ表示し、playerCarが有効な場合のみデータを表示
    const raceRelatedStatesForSpeedMonitor = ['signal_sequence', 'race', 'finished', 'all_finished'];
    if (raceRelatedStatesForSpeedMonitor.includes(gameState)) {
        let speedText = "Speed: N/A";
        let playerCarForMonitor = null;

        // cars配列とplayerCarIndexが有効かチェックし、プレイヤーの車情報を取得
        if (cars && cars.length > 0 && playerCarIndex >= 0 && playerCarIndex < cars.length && cars[playerCarIndex]) {
            playerCarForMonitor = cars[playerCarIndex];
        }

        if (playerCarForMonitor) {
            const displaySpeed = playerCarForMonitor.speed >= 0 ? playerCarForMonitor.speed : -playerCarForMonitor.speed;
            speedText = `Speed: ${Math.round(displaySpeed * 20)} km/h`;
        }

        // 描画処理
        ctx.font = 'bold 24px Arial'; // フォント設定を先に行い、measureText で使用
        const textWidth = ctx.measureText(speedText).width;
        const textHeight = 24; // フォントサイズに基づく高さ
        const padding = 10;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(padding, canvas.height - textHeight - padding * 2, textWidth + padding * 2, textHeight + padding);

        if (playerCarForMonitor && playerCarForMonitor.isInSlipstream) {
            ctx.fillStyle = 'lime'; // スリップストリーム中は緑色
        } else {
            ctx.fillStyle = 'white';
        }
        ctx.fillText(speedText, padding * 2, canvas.height - padding - 5);
    }


    // === 順位モニターの描画 (右上) ===
    // ゴールまでの距離(km)表示を右上に追加
    if (gameState !== 'replay') { // リプレイ中以外は表示 (以前の条件を簡略化)
        let distanceDisplayString = "";
        if (gameState === 'finished') { // この条件は上のifで弾かれるはずだが念のため
            distanceDisplayString = "Finished!";
        } else if (gameState === 'race' && distanceToGoal !== null) {
            distanceDisplayString = `To Goal: ${distanceToGoal.toFixed(3)} km`;
        } else if (gameState === 'signal_sequence') {
             distanceDisplayString = "Starting...";
        } else if (gameState === 'all_finished') {
            distanceDisplayString = "All Finished";
        } else { // race state but distanceToGoal is null (e.g. player not moving at very start)
             distanceDisplayString = "To Goal: --- km";
        }

        ctx.font = 'bold 18px Arial';
        const distanceTextMetrics = ctx.measureText(distanceDisplayString);
        const distancePadding = 10;
        const distanceBoxWidth = distanceTextMetrics.width + distancePadding * 2;
        const distanceBoxHeight = 18 + distancePadding * 1.5; // フォントサイズに合わせる
        const distanceBoxX = canvas.width - distanceBoxWidth - distancePadding;
        const distanceBoxY = distancePadding;

        // 背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(distanceBoxX, distanceBoxY, distanceBoxWidth, distanceBoxHeight);

        // テキスト
        ctx.fillStyle = 'white';
        ctx.textAlign = 'left'; // 左揃えで描画
        ctx.fillText(distanceDisplayString, distanceBoxX + distancePadding, distanceBoxY + 18 + distancePadding / 2 - 2);
    }

    // === リプレイUIの描画 (仮) ===
    if (gameState === 'replay') {
        // リプレイフレーム情報
        ctx.fillStyle = 'white';
        ctx.font = '16px Arial';
        ctx.fillText(`Replay: Frame ${replayFrameIndex} / ${raceHistory.length - 1}`, 10, canvas.height - 50);
        ctx.fillText(`Speed: ${replaySpeedMultiplier.toFixed(1)}x ${isReplayPaused ? "(Paused)" : ""}`, 10, canvas.height - 30);

        // 追尾ドライバー選択リスト
        const replayUiDriverListYStart = 50;
        const replayUiDriverListLineHeight = 20;
        const replayUiDriverListXStart = 10;
        ctx.font = '14px Verdana';

        // リアルタイムの順位でソートするための準備
        // cars配列はhandleReplayUpdateで現在のリプレイフレームの状態に更新されている
        // 元のインデックスを保持しつつソートする
        const sortedCarsForReplayList = cars
            .map((car, index) => ({
                ...car, // carオブジェクトの全プロパティをコピー
                originalIndex: index // 元のインデックスを保持 (selectedReplayCarIndexとの比較用)
            }))
            .sort((a, b) => a.y - b.y); // Y座標で昇順ソート (小さい方が上位)

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        // sortedCarsForReplayList.length を使用
        ctx.fillRect(replayUiDriverListXStart - 5, replayUiDriverListYStart - replayUiDriverListLineHeight, 200, sortedCarsForReplayList.length * replayUiDriverListLineHeight + 10);

        sortedCarsForReplayList.forEach((carData, sortedIndex) => { // ソート済みリストでループ
            // carData.originalIndex が selectedReplayCarIndex と一致するかで判定
            if (carData.originalIndex === selectedReplayCarIndex) {
                ctx.fillStyle = 'yellow'; // 現在選択中のドライバーをハイライト
            } else {
                ctx.fillStyle = 'white';
            }
            // 表示する順位はソート後のインデックス (sortedIndex + 1)
            ctx.fillText(`${sortedIndex + 1}. ${carData.driverName}`, replayUiDriverListXStart, replayUiDriverListYStart + sortedIndex * replayUiDriverListLineHeight);
        });
    }

    // Replayボタンの描画 (isVisibleがtrueの時、gameStateに依存しない)
    // この描画は他のUI要素より手前（最後の方）で行う
    if (replayButton.isVisible) { // キャリアモードでも表示するように変更
        // gameStateが 'finished' や 'all_finished' の時のスタイルを流用
        // または、リプレイ終了時専用のスタイルを定義しても良い
        ctx.fillStyle = 'rgba(100, 100, 200, 0.8)';
        ctx.fillRect(replayButton.x, replayButton.y, replayButton.width, replayButton.height);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(replayButton.text, replayButton.x + replayButton.width / 2, replayButton.y + replayButton.height / 2 + 8);
        ctx.textAlign = 'left'; // textAlignを戻す
    }

    // Calculate positions for career mode replay end buttons
    if (careerPlayerTeamName && gameState === 'replay' && isReplayPaused) {
        if (careerReplayAgainButton.isVisible && careerReplayBackButton.isVisible) {
            const buttonGroupTotalWidth = careerReplayBackButton.width + 20 + careerReplayAgainButton.width;
            const buttonGroupStartX = canvas.width / 2 - buttonGroupTotalWidth / 2;
            careerReplayBackButton.x = buttonGroupStartX;
            careerReplayBackButton.y = canvas.height - careerReplayBackButton.height - 30;
            careerReplayAgainButton.x = careerReplayBackButton.x + careerReplayBackButton.width + 20;
            careerReplayAgainButton.y = careerReplayBackButton.y;
        } else if (careerReplayBackButton.isVisible) { // Only "Return to Results"
            careerReplayBackButton.x = canvas.width / 2 - careerReplayBackButton.width / 2;
            careerReplayBackButton.y = canvas.height - careerReplayBackButton.height - 30;
        }
    }

    // キャリアモードのリプレイ終了後「結果に戻る」ボタンの描画
    if (careerReplayBackButton.isVisible) {
        ctx.fillStyle = 'rgba(0, 150, 150, 0.8)'; // 少し違う色で
        ctx.fillRect(careerReplayBackButton.x, careerReplayBackButton.y, careerReplayBackButton.width, careerReplayBackButton.height);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(careerReplayBackButton.text, careerReplayBackButton.x + careerReplayBackButton.width / 2, careerReplayBackButton.y + careerReplayBackButton.height / 2 + 8);
        ctx.textAlign = 'left';
    }

    // キャリアモードのリプレイ終了後「もう一度リプレイを見る」ボタンの描画
    if (careerReplayAgainButton.isVisible) {
        ctx.fillStyle = 'rgba(150, 0, 150, 0.8)'; // Different color
        ctx.fillRect(careerReplayAgainButton.x, careerReplayAgainButton.y, careerReplayAgainButton.width, careerReplayAgainButton.height);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 20px Arial'; // Slightly smaller font for longer text
        ctx.textAlign = 'center';
        ctx.fillText(careerReplayAgainButton.text, careerReplayAgainButton.x + careerReplayAgainButton.width / 2, careerReplayAgainButton.y + careerReplayAgainButton.height / 2 + 7);
        ctx.textAlign = 'left';
    }
    // gameState === 'all_finished' の時のボタン描画
    if (gameState === 'all_finished' && careerPlayerTeamName) {
        // 「NEXT」ボタンの描画 (リプレイボタンより上)
        if (careerNextButton.isVisible) {
            // X座標はリプレイボタンと共通化された commonButtonX を使う想定だが、
            // replayButton.x が既に設定されているのでそれを利用
            careerNextButton.x = replayButton.x + (replayButton.width - careerNextButton.width) / 2; // リプレイボタンの中央に合わせる
            careerNextButton.y = replayButton.y - careerNextButton.height - 10; // リプレイボタンの少し上

            ctx.fillStyle = 'rgba(200, 100, 0, 0.9)'; // オレンジ系のボタン
            ctx.fillRect(careerNextButton.x, careerNextButton.y, careerNextButton.width, careerNextButton.height);
            ctx.fillStyle = 'white';
            ctx.font = 'bold 22px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(careerNextButton.text, careerNextButton.x + careerNextButton.width / 2, careerNextButton.y + careerNextButton.height / 2 + 7);
            ctx.textAlign = 'left'; // textAlignを戻す
        }
    } else if (gameState === 'all_finished' && careerPlayerTeamName === null) { // クイックレースの場合
        if (quickRaceBackButton.isVisible) {
            quickRaceBackButton.x = replayButton.x + (replayButton.width - quickRaceBackButton.width) / 2; // リプレイボタンの中央に合わせる
            quickRaceBackButton.y = replayButton.y - quickRaceBackButton.height - 10; // リプレイボタンの少し上

            ctx.fillStyle = 'rgba(100, 100, 100, 0.9)'; // グレー系のボタン
            ctx.fillRect(quickRaceBackButton.x, quickRaceBackButton.y, quickRaceBackButton.width, quickRaceBackButton.height);
            ctx.fillStyle = 'white'; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center';
            ctx.fillText(quickRaceBackButton.text, quickRaceBackButton.x + quickRaceBackButton.width / 2, quickRaceBackButton.y + quickRaceBackButton.height / 2 + 7);
            ctx.textAlign = 'left'; // textAlignを戻す
        }
    }

    // キャリアモードのロスタースクリーンで「シーズン開始」ボタンを描画 (正しい位置に移動)
    if (careerStartSeasonButton.isVisible && gameState === 'career_roster') {
        // ... (careerStartSeasonButton の描画ロジックは変更なし、位置のみ修正)
        //     ctx.fillStyle = 'rgba(0, 150, 50, 0.8)';
        //     ctx.fillRect(nextStepButton.x, nextStepButton.y, nextStepButton.width, nextStepButton.height);
        //     ctx.fillStyle = 'white';
        //     ctx.font = 'bold 20px Arial';
        //     ctx.textAlign = 'center';
        //     ctx.fillText(nextStepButton.text, nextStepButton.x + nextStepButton.width / 2, nextStepButton.y + nextStepButton.height / 2 + 7);
        //     ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(0, 150, 50, 0.9)'; // 緑系のボタン
    }

    // 汎用セーブボタンの描画 (特定の画面でのみ表示)
    if (generalSaveButton.isVisible) {
        ctx.fillStyle = 'rgba(0, 180, 100, 0.8)';
        ctx.fillRect(generalSaveButton.x, generalSaveButton.y, generalSaveButton.width, generalSaveButton.height);
        ctx.fillStyle = 'white'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center';
        ctx.fillText(generalSaveButton.text, generalSaveButton.x + generalSaveButton.width / 2, generalSaveButton.y + generalSaveButton.height / 2 + 6);
        ctx.textAlign = 'left';
        
    }
}


// ====== キャリアモード関連の関数 ======
function handleCareerModeButtonClick() {
    gameState = 'career_name_entry'; // 一時的に状態を変更
    const firstName = prompt("キャリアモードへようこそ！\nあなたの名を入力してください:", careerPlayerName.firstName || "Player");
    if (firstName === null || firstName.trim() === "") {
        alert("名の入力がキャンセルされたか、空です。");
        gameState = 'driver_selection';
        return;
    }

    const lastName = prompt("あなたの姓を入力してください:", careerPlayerName.lastName || "One");
    if (lastName === null || lastName.trim() === "") {
        alert("姓の入力がキャンセルされたか、空です。");
        gameState = 'driver_selection';
        return;
    }

    careerPlayerName.firstName = firstName.trim();
    careerPlayerName.lastName = lastName.trim();
    const formattedDisplayName = formatPlayerDisplayName(careerPlayerName.firstName, careerPlayerName.lastName);
    
    // 年齢の入力
    const ageInput = prompt(`次に、あなたの年齢を入力してください (例: 18):`, "18");
    let playerAge = 18; // デフォルト年齢
    if (ageInput !== null) {
        const parsedAge = parseInt(ageInput, 10);
        if (!isNaN(parsedAge) && parsedAge >= 16 && parsedAge <= 60) { // 簡単なバリデーション
            playerAge = parsedAge;
        } else {
            alert("無効な年齢が入力されたか、範囲外です。デフォルトの18歳に設定します。");
        }
    } else {
        alert("年齢の入力がキャンセルされました。デフォルトの18歳に設定します。");
    }

    chosenPlayerInfo.age = playerAge; // プレイヤーの年齢を設定
    // 3文字表記の入力
    const defaultShortName = careerPlayerName.lastName.substring(0, 3).toUpperCase();
    const shortNameInput = prompt(`あなたの3文字表記を入力してください (例: VER)。\nデフォルトは姓の頭3文字です:`, defaultShortName);
    let finalShortName = defaultShortName;

    if (shortNameInput !== null && shortNameInput.trim() !== "") {
        // 3文字で、英大文字または数字のみを許容する正規表現
        if (shortNameInput.trim().length === 3 && /^[A-Z0-9]{3}$/.test(shortNameInput.trim().toUpperCase())) {
            finalShortName = shortNameInput.trim().toUpperCase();
        } else {
            alert("3文字表記は3文字の英大文字または数字である必要があります。デフォルト値を使用します。");
        }
    } else {
        alert("3文字表記の入力がキャンセルされたか、空です。デフォルト値を使用します。");
    }

    chosenPlayerInfo.driverName = finalShortName; // プレイヤーの3文字表記を設定
    chosenPlayerInfo.fullName = careerPlayerName.firstName + " " + careerPlayerName.lastName; // フルネームも設定

    alert(`ようこそ、${careerPlayerName.firstName} ${careerPlayerName.lastName} (${chosenPlayerInfo.driverName}) さん (年齢: ${chosenPlayerInfo.age}歳)！\n次に契約するチームを選択してください。`);
    console.log("Career mode: Name entered - ", careerPlayerName, "Display name:", chosenPlayerInfo.driverName, "Age:", chosenPlayerInfo.age);

    // chosenPlayerInfo の他の情報はチーム選択後に設定される
    gameState = 'career_team_selection'; // チーム選択画面へ
}

function drawCareerTeamSelectionScreen() {
    ctx.save();
    // 背景
    ctx.fillStyle = 'rgba(20, 20, 20, 0.98)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // タイトル
    ctx.fillStyle = 'white';
    ctx.font = 'bold 36px "Formula1 Display Wide", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    const displayTitleName = formatPlayerDisplayName(careerPlayerName.firstName, careerPlayerName.lastName);
    ctx.fillText(`CHOOSE YOUR STARTING TEAM, ${displayTitleName}`, canvas.width / 2, 60);

    // 選択可能なチームの描画
    const itemHeight = 50; // ボタンの高さ
    const itemPadding = 20; // ボタン間の余白
    const buttonWidth = 300;
    const startY = 120; // タイトルの下から開始

    careerModeAvailableTeams.forEach((teamName, index) => {
        const buttonX = canvas.width / 2 - buttonWidth / 2;
        const buttonY = startY + index * (itemHeight + itemPadding);

        ctx.fillStyle = 'rgba(0, 100, 200, 0.8)'; // ボタンの色
        ctx.fillRect(buttonX, buttonY, buttonWidth, itemHeight);

        ctx.fillStyle = 'white';
        ctx.font = 'bold 22px Arial';
        // チーム選択肢のドライバー名もフォーマットを統一する（もし必要なら）
        // ここでは既存の driverLineups の名前をそのまま使う
        const teamDrivers = driverLineups[teamName] ? driverLineups[teamName].drivers : [];
        let teamDisplayString = teamName;
        if (teamDrivers.length >= 2) {
            teamDisplayString = `${teamDrivers[0].name.split('.')[0]} / ${teamDrivers[1].name.split('.')[0]} (${teamName})`;
        } else if (teamDrivers.length === 1) {
            teamDisplayString = `${teamDrivers[0].name.split('.')[0]} / - (${teamName})`;
        }
        ctx.fillText(teamDisplayString, canvas.width / 2, buttonY + itemHeight / 2 + 8);
    });
    ctx.restore();
}

function drawCareerRosterScreen() {
    ctx.save();
    // 背景
    ctx.fillStyle = 'rgba(25, 25, 25, 0.98)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // タイトル
    ctx.fillStyle = 'white';
    ctx.font = 'bold 36px "Formula1 Display Wide", "Arial Black", sans-serif';
    ctx.textAlign = 'center'; // 中央揃え
    ctx.fillText(`SEASON ${currentSeasonNumber} - DRIVER ROSTER`, canvas.width / 2, 60);

    // ドライバーリストの描画設定
    const listStartY = 120;
    const lineHeight = 22;
    const columnPadding = 30; // 列間のパディング
    const firstColumnX = 50;
    const secondColumnX = canvas.width / 2 + columnPadding / 2;
    const driversPerColumn = Math.ceil(NUM_CARS / 2);

    ctx.font = '18px "Formula1 Display Regular", Arial, sans-serif';
    ctx.textAlign = 'left';

    for (let i = 0; i < cars.length; i++) {
        const car = cars[i];
        const isPlayer = (i === playerCarIndex);
        const rank = car.startingGridRank; // グリッド順位を使用 (cars配列はグリッド順にソートされている想定)

        const ratingDisplay = isPlayer ? "N/A" : car.rating;
        const driverText = `${rank}. ${car.fullName} (${car.teamName || 'N/A'}) - Age: ${car.age} - Rating: ${ratingDisplay}`;

        let x, y;
        if (i < driversPerColumn) { // 1列目
            x = firstColumnX;
            y = listStartY + i * lineHeight;
        } else { // 2列目
            x = secondColumnX;
            y = listStartY + (i - driversPerColumn) * lineHeight;
        }

        ctx.fillStyle = isPlayer ? 'yellow' : 'white';
        ctx.fillText(driverText, x, y);
    }

    // 「NEXT」(シーズン開始)ボタンの準備と表示
    careerStartSeasonButton.isVisible = true;
    careerStartSeasonButton.x = canvas.width / 2 - careerStartSeasonButton.width / 2;
    careerStartSeasonButton.y = canvas.height - careerStartSeasonButton.height - 30;

    generalSaveButton.isVisible = true;
    generalSaveButton.x = canvas.width - generalSaveButton.width - 20; // 右上に配置
    generalSaveButton.y = 20;

    // 「NEXT」ボタンの描画
    // careerStartSeasonButton.isVisible はこの関数の冒頭で true に設定されているため、
    // ここで直接描画します。
    ctx.fillStyle = 'rgba(0, 150, 50, 0.9)'; // 緑系のボタン
    ctx.fillRect(careerStartSeasonButton.x, careerStartSeasonButton.y, careerStartSeasonButton.width, careerStartSeasonButton.height);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(careerStartSeasonButton.text, careerStartSeasonButton.x + careerStartSeasonButton.width / 2, careerStartSeasonButton.y + careerStartSeasonButton.height / 2 + 7);
    ctx.textAlign = 'left'; // textAlignをリセット

    // 汎用セーブボタンの描画 (この画面は早期リターンするため、ここで描画)
    if (generalSaveButton.isVisible) {
        ctx.fillStyle = 'rgba(0, 180, 100, 0.8)';
        ctx.fillRect(generalSaveButton.x, generalSaveButton.y, generalSaveButton.width, generalSaveButton.height);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 18px Arial'; // フォントを再設定
        ctx.textAlign = 'center';     // ボタンテキスト用に中央揃え
        ctx.fillText(generalSaveButton.text, generalSaveButton.x + generalSaveButton.width / 2, generalSaveButton.y + generalSaveButton.height / 2 + 6);
    }
    ctx.textAlign = 'left'; // textAlignをリセット

    ctx.restore();
}

// Helper function to get parameters for drawing a scrollbar
function getScrollbarRenderParams(contentTotalHeight, scrollableAreaY, scrollableAreaHeight, currentScrollY) {
    const maxScroll = Math.max(0, contentTotalHeight - scrollableAreaHeight);
    let thumbHeight = 0;
    let thumbY = scrollableAreaY;

    if (maxScroll > 0 && scrollableAreaHeight > 0 && contentTotalHeight > 0) {
        thumbHeight = Math.max(SCROLLBAR_MIN_THUMB_HEIGHT, scrollableAreaHeight * (scrollableAreaHeight / contentTotalHeight));
        thumbHeight = Math.min(thumbHeight, scrollableAreaHeight); // Thumb cannot be taller than track
        const scrollableRatio = currentScrollY / maxScroll;
        thumbY = scrollableAreaY + scrollableRatio * (scrollableAreaHeight - thumbHeight);
    } else if (scrollableAreaHeight > 0) { // No scrolling needed, thumb is full height
        thumbHeight = scrollableAreaHeight;
        thumbY = scrollableAreaY;
    }

    return {
        x: canvas.width - SCROLLBAR_WIDTH - SCROLLBAR_PADDING,
        trackY: scrollableAreaY,
        trackHeight: scrollableAreaHeight,
        thumbY: thumbY,
        thumbHeight: thumbHeight,
        currentScroll: currentScrollY,
        maxScroll: maxScroll,
        contentTotalHeight: contentTotalHeight
    };
}

function drawCareerSeasonEndScreen() {
    ctx.save();
    ctx.fillStyle = 'rgba(20, 20, 20, 0.98)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let titleText;
    let buttonText;

    if (currentRaceInSeason < RACES_PER_SEASON) { // レース終了時
        titleText = `DRIVER STANDINGS - RACE ${currentRaceInSeason}/${RACES_PER_SEASON} (S${currentSeasonNumber})`;
        buttonText = "View Team Standings";
    } else { // シーズン終了時
        titleText = `FINAL DRIVER STANDINGS - SEASON ${currentSeasonNumber}`;
        buttonText = "View Final Team Standings";
    }

    ctx.fillStyle = 'white';
    ctx.font = 'bold 32px "Formula1 Display Wide", "Arial Black", sans-serif'; // 少しフォントサイズ調整
    ctx.textAlign = 'center';
    ctx.fillText(titleText, canvas.width / 2, 60);

    // --- 全ドライバーのリストを作成し、ポイントを割り当てる ---
    let allDriversData = [];
    if (currentRaceInSeason < RACES_PER_SEASON) { // レース終了時
        // cars 配列 (レース終了時のメンバー) を基準にする
        // cars 配列は initializeCars でグリッド順にソートされているが、
        // レース結果表示ではポイント順にソートするので、ここでは元の cars 配列を使う
        cars.forEach(car => { // initializeCars 直後の cars 配列を参照すべき
            const points = careerDriverSeasonPoints[car.driverName] || 0;
            allDriversData.push({
                shortName: car.driverName, // ポイントオブジェクトのキー照合用
                fullName: car.fullName,   // 表示用フルネーム
                points: points,
                isPlayer: (car.driverName === chosenPlayerInfo.driverName) // プレイヤー判定
            });
        });
    } else { // シーズン終了時
        // driverLineups からAIドライバーの情報を収集 (移籍が反映されている可能性)
        for (const teamName in driverLineups) {
            const team = driverLineups[teamName];
            team.drivers.forEach((driver) => {
                // プレイヤーの情報は別途 chosenPlayerInfo から取得するため、
                // ここでプレイヤー自身 (chosenPlayerInfo.driverName と一致し、プレイヤーの現チームにいるドライバー) はスキップする。
                if (teamName === careerPlayerTeamName && driver.name === chosenPlayerInfo.driverName) {
                    return; // プレイヤー自身なのでスキップ
                }
                const points = careerDriverSeasonPoints[driver.name] || 0;
                allDriversData.push({
                    shortName: driver.name,
                    fullName: driver.fullName,
                    points: points,
                    isPlayer: false // このループではAIドライバーのみを対象とする
                });
            });
        }
        // プレイヤー自身の情報を chosenPlayerInfo から取得して追加
        const playerPoints = careerDriverSeasonPoints[chosenPlayerInfo.driverName] || 0;
        allDriversData.push({
            shortName: chosenPlayerInfo.driverName,
            fullName: chosenPlayerInfo.fullName, // chosenPlayerInfo には fullName が設定されている想定
            points: playerPoints,
            isPlayer: true // プレイヤーなのでtrue
        });
    }
    // ポイントに基づいてドライバーをソート (降順)
    allDriversData.sort((a, b) => b.points - a.points);

    // スクロール可能なリスト表示領域の定義
    const lineHeight = 25;
    const listDisplayStartY = 120; // リストが画面上に表示され始めるY座標
    const listDisplayEndY = canvas.height - 120; // リストが画面上に表示され終わるY座標 (ボタンの上まで)
    const numDrivers = allDriversData.length; // スクロール範囲計算用に更新

    // 表示列のX座標設定
    const rankX = canvas.width / 2 - 180; // 順位のX座標
    const nameX = canvas.width / 2 - 150; // 名前のX座標
    const pointsX = canvas.width / 2 + 150; // ポイントのX座標

    ctx.font = 'bold 20px Arial';
    // ctx.textAlign = 'center'; // 個別に設定するためコメントアウト

    allDriversData.forEach((driverData, index) => {
        const rank = index + 1;
        let displayName = driverData.fullName; // 表示はフルネーム

        // 各リスト項目の絶対的なY座標 (スクロールがない場合のY座標)
        const itemAbsoluteY = listDisplayStartY + index * lineHeight;
        // スクロールを考慮した画面上のY座標
        const itemScrolledY = itemAbsoluteY - careerSeasonEndScrollY;

        // フルネームを取得
        // 項目が描画範囲内にある場合のみフルネーム検索と描画を行う
        if (itemScrolledY >= listDisplayStartY - lineHeight && itemScrolledY < listDisplayEndY + lineHeight) {
            // displayName は既に driverData.fullName で設定済み

            if (driverData.isPlayer) { // プレイヤーの成績を強調
                ctx.fillStyle = 'yellow';
            } else {
                ctx.fillStyle = 'white';
            }

            // 順位
            ctx.textAlign = 'right';
            ctx.fillText(`${rank}.`, rankX, itemScrolledY);

            // 名前
            ctx.textAlign = 'left';
            ctx.fillText(displayName, nameX, itemScrolledY);

            // ポイント
            ctx.textAlign = 'right';
            ctx.fillText(`${driverData.points} pts`, pointsX, itemScrolledY);
        }
    });

    // アクションボタン (Next Race / View Team Offers)
    const actionButton = {
        x: canvas.width / 2 - 150,
        y: canvas.height - 100,
        width: 300,
        height: 50,
        text: buttonText
    };

    ctx.fillStyle = 'rgba(0, 100, 200, 0.8)';
    ctx.fillRect(actionButton.x, actionButton.y, actionButton.width, actionButton.height);
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px Arial';
    ctx.fillText(actionButton.text, actionButton.x + actionButton.width / 2, actionButton.y + actionButton.height / 2 + 8);

    // Draw Scrollbar
    const scrollableAreaY = listDisplayStartY;
    const scrollableAreaHeight = listDisplayEndY - listDisplayStartY;
    const contentTotalHeight = allDriversData.length * lineHeight;

    const scrollParams = getScrollbarRenderParams(contentTotalHeight, scrollableAreaY, scrollableAreaHeight, careerSeasonEndScrollY);
    if (scrollParams.maxScroll > 0) {
        drawScrollbar(ctx, scrollParams.x, scrollParams.trackY, scrollParams.trackHeight, scrollParams.thumbY, scrollParams.thumbHeight);
    }





    // generalSaveButton.isVisible はここでは設定しない (デフォルトでfalseのまま)
    // generalSaveButton.x, generalSaveButton.y も設定不要
    // 描画もメインのdraw関数に任せるか、ここでは行わない (isVisibleがfalseなので描画されない)

    ctx.textAlign = 'left'; //念のためtextAlignをリセット
    ctx.restore();
}

function drawCareerTeamStandingsScreen() {
    ctx.save();
    ctx.fillStyle = 'rgba(20, 20, 20, 0.98)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let titleText;
    let buttonText;

    if (currentRaceInSeason < RACES_PER_SEASON) { // レース終了時
        titleText = `TEAM STANDINGS - RACE ${currentRaceInSeason}/${RACES_PER_SEASON} (S${currentSeasonNumber})`;
        buttonText = "Next Race";
    } else { // シーズン終了時
        titleText = `FINAL TEAM STANDINGS - SEASON ${currentSeasonNumber}`;
        buttonText = "View Team Offers";
    }

    ctx.fillStyle = 'white';
    ctx.font = 'bold 32px "Formula1 Display Wide", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(titleText, canvas.width / 2, 60);

    // スクロール可能なリスト表示領域の定義
    const listDisplayStartY = 120;
    const listDisplayEndY = canvas.height - 120;
    const teamLineHeight = 25;
    // 表示列のX座標設定 (ドライバーランキングと合わせるか、専用に調整)
    const teamRankX = canvas.width / 2 - 180;
    const teamNameX = canvas.width / 2 - 150;
    const teamPointsX = canvas.width / 2 + 150;

    // --- チームポイントの表示 ---
    const teamListHeaderY = listDisplayStartY; // チームリストは上から開始

    ctx.font = 'bold 24px "Formula1 Display Wide", Arial, sans-serif'; // チームランキングのタイトル (ヘッダーとして)
    ctx.fillStyle = 'white';
    // ctx.textAlign = 'center'; // 個別に設定するためコメントアウト
    // ヘッダーはスクロールしない固定表示とするか、リストの一部としてスクロールさせるか。ここではリストの一部とする。
    // const teamListHeaderScrolledY = teamListHeaderY - careerSeasonEndScrollY;
    // if (teamListHeaderScrolledY >= listDisplayStartY - teamLineHeight && teamListHeaderScrolledY < listDisplayEndY + teamLineHeight * 2) {
    //     ctx.fillText("TEAM STANDINGS", canvas.width / 2, teamListHeaderScrolledY);
    // }

    let teamStandings = [];
    for (const teamName in careerTeamSeasonPoints) {
        teamStandings.push({ name: teamName, points: careerTeamSeasonPoints[teamName] });
    }
    teamStandings.sort((a, b) => b.points - a.points); // ポイントで降順ソート

    ctx.font = 'bold 20px Arial'; // チームリストのフォント
    teamStandings.forEach((teamData, index) => {
        const rank = index + 1;
        // const text = `${rank}. ${teamData.name} - ${teamData.points} pts`;
        const itemAbsoluteY = teamListHeaderY + index * teamLineHeight; // ヘッダーの分下にずらす
        const itemScrolledY = itemAbsoluteY - careerSeasonEndScrollY;

        if (itemScrolledY >= listDisplayStartY - teamLineHeight && itemScrolledY < listDisplayEndY + teamLineHeight) {
            ctx.fillStyle = (teamData.name === careerPlayerTeamName) ? 'cyan' : 'white'; // プレイヤー所属チームをハイライト

            // 順位
            ctx.textAlign = 'right';
            ctx.fillText(`${rank}.`, teamRankX, itemScrolledY);

            // チーム名
            ctx.textAlign = 'left';
            ctx.fillText(teamData.name, teamNameX, itemScrolledY);

            // ポイント
            ctx.textAlign = 'right';
            ctx.fillText(`${teamData.points} pts`, teamPointsX, itemScrolledY);
        }
    });

    // アクションボタン
    const actionButton = { x: canvas.width / 2 - 150, y: canvas.height - 100, width: 300, height: 50, text: buttonText };
    ctx.fillStyle = 'rgba(0, 100, 200, 0.8)';
    ctx.fillRect(actionButton.x, actionButton.y, actionButton.width, actionButton.height);
    ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.font = 'bold 22px Arial';
    ctx.fillText(actionButton.text, actionButton.x + actionButton.width / 2, actionButton.y + actionButton.height / 2 + 8);
    ctx.restore();

    // Draw Scrollbar for Team Standings
    const scrollableAreaY_teams = listDisplayStartY; // Same as driver standings for Y start
    const scrollableAreaHeight_teams = listDisplayEndY - listDisplayStartY; // Same visible height
    const contentTotalHeight_teams = teamStandings.length * teamLineHeight;
    const scrollParamsTeams = getScrollbarRenderParams(contentTotalHeight_teams, scrollableAreaY_teams, scrollableAreaHeight_teams, careerSeasonEndScrollY);
    if (scrollParamsTeams.maxScroll > 0) {
        drawScrollbar(ctx, scrollParamsTeams.x, scrollParamsTeams.trackY, scrollParamsTeams.trackHeight, scrollParamsTeams.thumbY, scrollParamsTeams.thumbHeight);
    }
    // generalSaveButton.isVisible はここでは設定しない (デフォルトでfalseのまま)
    // generalSaveButton.x, generalSaveButton.y も設定不要
    // 描画もメインのdraw関数に任せるか、ここでは行わない (isVisibleがfalseなので描画されない)

    // ctx.textAlign = 'left'; // ctx.restore() で戻るので不要な場合が多い
}


function drawCareerMachinePerformanceScreen() {
    ctx.save();
    // 背景
    ctx.fillStyle = 'rgba(22, 22, 22, 0.98)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // タイトル
    ctx.fillStyle = 'white';
    ctx.font = 'bold 36px "Formula1 Display Wide", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`MACHINE PERFORMANCE - SEASON ${currentSeasonNumber}`, canvas.width / 2, 60);

    // チーム資金表示
    ctx.font = 'bold 18px Arial';
    ctx.fillStyle = 'gold';
    ctx.textAlign = 'left';
    ctx.fillText(`Team Funds: $${driverLineups[careerPlayerTeamName]?.funds.toLocaleString() || 0}`, 50, 95);

    // グラフ描画エリア設定
    ctx.save(); // グラフ描画エリアのクリッピングのために保存

    // === リスト表示とクリッピング領域の調整 ===
    const listStartX = 50; // チーム名とバーを含むリスト全体の開始X座標
    const teamNameDisplayWidth = 110; // チーム名表示のための幅
    const spaceAfterTeamName = 10; // チーム名とバーの間のスペース
    const barChartRenderStartX = listStartX + teamNameDisplayWidth + spaceAfterTeamName; // バーが実際に描画開始されるX座標

    const graphAreaY = 120;
    const barChartRenderWidth = canvas.width - barChartRenderStartX - listStartX; // バー描画に使用できる幅 (左右マージンを考慮)
    const graphAreaHeight = canvas.height - graphAreaY - 70; // 下部ボタンマージン (100 -> 70)

    // let teams = Object.keys(driverLineups); // 元の取得方法
    let teamsToDisplay;
    if (Object.keys(previousSeasonPointsForDisplay).length > 0) {
        // previousSeasonPointsForDisplay にデータがある場合 (通常はシーズン2以降)
        // このデータは前シーズンの最終チームポイントのはず
        teamsToDisplay = Object.keys(driverLineups).sort((a, b) => {
            const pointsA = previousSeasonPointsForDisplay[a] || 0;
            const pointsB = previousSeasonPointsForDisplay[b] || 0;
            if (pointsB !== pointsA) {
                return pointsB - pointsA; // 1. 前シーズンのポイント降順
            }
            // ポイントが同じ場合はティアでソート (ティア昇順)
            const tierA = driverLineups[a] ? driverLineups[a].tier : 99;
            const tierB = driverLineups[b] ? driverLineups[b].tier : 99;
            return tierA - tierB;
        });
        console.log("Machine Performance: Sorted by previous season team points using previousSeasonPointsForDisplay.");
    } else {
        // previousSeasonPointsForDisplay が空の場合 (例: シーズン1)
        // 現在のチームティアに基づいてソート (ティア昇順、ティアが同じならチーム名昇順)
        teamsToDisplay = Object.keys(driverLineups).sort((a, b) => {
            const tierA = driverLineups[a] ? driverLineups[a].tier : 99;
            const tierB = driverLineups[b] ? driverLineups[b].tier : 99;
            if (tierA !== tierB) return tierA - tierB;
            return a.localeCompare(b);
        });
        console.log("Machine Performance: Sorted by current team tier (as previousSeasonPointsForDisplay is empty).");
    }

    // グラフ描画エリアでクリッピング
    ctx.beginPath();
    ctx.rect(listStartX, graphAreaY, canvas.width - 2 * listStartX, graphAreaHeight); // クリップ領域を調整
    ctx.clip();
    const numTeams = teamsToDisplay.length;
    const barHeight = 18; // 各性能の棒の高さ
    const barGap = 4;    // 加速力と最高速の棒の間のギャップ
    const teamGap = 12;  // チーム間のギャップ (少し詰める)
    const totalTeamBlockHeight = barHeight * 2 + barGap + teamGap;
    // グラフのX軸スケール
    const minValue = 0.8; // 性能値の最小表示範囲
    const maxValue = 1.2; // 性能値の最大表示範囲
    const valueRange = maxValue - minValue;

    // 基準線 (1.0)
    const baselineX = barChartRenderStartX + ( (1.0 - minValue) / valueRange ) * barChartRenderWidth;
    ctx.strokeStyle = 'grey';
    ctx.lineWidth = 1;
    // 基準線はクリッピング範囲外にも描画したい場合があるため、クリッピング前に描画するか、クリッピング後に別途描画する
    ctx.beginPath();
    ctx.moveTo(baselineX, graphAreaY); // グラフエリアの上端から
    ctx.lineTo(baselineX, graphAreaY + graphAreaHeight); // グラフエリアの下端まで
    ctx.stroke();
    ctx.fillStyle = 'white'; // 基準値のテキストは白に
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText("1.0", baselineX, graphAreaY - 15);

    teamsToDisplay.forEach((teamName, index) => {
        const teamData = driverLineups[teamName];
        const teamY = graphAreaY + index * totalTeamBlockHeight - careerMachinePerformanceScrollY;

        // チーム名の描画 (バーの左側、クリップ領域内)
        ctx.fillStyle = (teamName === careerPlayerTeamName) ? 'yellow' : 'white';
        ctx.font = 'bold 15px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(teamName, listStartX + 5, teamY + barHeight + barGap / 2 + 2);

        const drawBar = (value, yOffset, color, label) => {
            const factor = Math.max(minValue, Math.min(maxValue, value || 1.0)); // 範囲内に収める
            // バーの幅は barChartRenderWidth を基準に計算
            const barW = ((factor - minValue) / valueRange) * barChartRenderWidth;
            ctx.fillStyle = color;
            // バーの描画開始X座標は barChartRenderStartX
            const currentBarY = teamY + yOffset;
            ctx.fillRect(barChartRenderStartX, currentBarY, Math.max(0, barW), barHeight);
            ctx.fillStyle = 'white';
            ctx.font = '11px Arial';
            ctx.textAlign = 'left'; // 数値は棒の右に左寄せ
            ctx.fillText((value || 1.0).toFixed(3), barChartRenderStartX + Math.max(0, barW) + 5, teamY + yOffset + barHeight / 2 + 4);

        };

        // グラフが描画範囲内にない場合は描画をスキップ (軽量化)
        if (teamY + totalTeamBlockHeight < graphAreaY || teamY > graphAreaY + graphAreaHeight) {
            return; // continue相当
        }
        drawBar(teamData.accelerationFactor, 0, 'rgba(100, 100, 255, 0.8)', "Accel");
        drawBar(teamData.maxSpeedFactor, barHeight + barGap, 'rgba(255, 100, 100, 0.8)', "Speed");
    });

    ctx.restore(); // クリッピングを解除

    // === ボタンの描画 ===
    // セーブボタン
    generalSaveButton.isVisible = true;
    generalSaveButton.x = canvas.width - generalSaveButton.width - 20;
    generalSaveButton.y = 20;
    // セーブボタンの描画ロジックは draw 関数から移動させる

    // === 凡例の描画 (右下) ===
    const legendX = canvas.width - 180; // 右からのマージン
    const legendY = canvas.height - 80; // 下からのマージンを少し増やす
    const legendItemHeight = 25; // 凡例アイテムの高さを少し増やす
    const legendSquareSize = 15;
    const legendTextOffsetX = 20;

    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';

    // 加速力
    ctx.fillStyle = 'rgba(100, 100, 255, 0.8)';
    ctx.fillRect(legendX, legendY, legendSquareSize, legendSquareSize);
    ctx.fillStyle = 'white';
    ctx.fillText("Acceleration", legendX + legendTextOffsetX, legendY + legendSquareSize / 2 + 5);

    // 最高速
    ctx.fillStyle = 'rgba(255, 100, 100, 0.8)';
    ctx.fillRect(legendX, legendY + legendItemHeight, legendSquareSize, legendSquareSize);
    ctx.fillStyle = 'white';
    ctx.fillText("Max Speed", legendX + legendTextOffsetX, legendY + legendItemHeight + legendSquareSize / 2 + 5);
    // === 凡例の描画ここまで ===

    // NEXTボタンの準備 (凡例の上、右下に配置)
    // isVisible はこの関数内で true に設定
    careerMachinePerformanceNextButton.isVisible = true;
    careerMachinePerformanceNextButton.width = 120; // サイズは既存のまま
    careerMachinePerformanceNextButton.height = 40;
    careerMachinePerformanceNextButton.x = legendX + (180 - legendTextOffsetX - legendSquareSize - careerMachinePerformanceNextButton.width) / 2; // 凡例エリアの右側に配置
    careerMachinePerformanceNextButton.y = legendY - careerMachinePerformanceNextButton.height - 15; // 凡例の少し上

    // NEXTボタンの描画ロジックは draw 関数から移動させる
    ctx.fillStyle = 'rgba(0, 100, 200, 0.9)'; // 青系のボタン
    ctx.fillRect(careerMachinePerformanceNextButton.x, careerMachinePerformanceNextButton.y, careerMachinePerformanceNextButton.width, careerMachinePerformanceNextButton.height);
    ctx.fillStyle = 'white'; ctx.font = 'bold 20px Arial'; ctx.textAlign = 'center';
    ctx.fillText(careerMachinePerformanceNextButton.text, careerMachinePerformanceNextButton.x + careerMachinePerformanceNextButton.width / 2, careerMachinePerformanceNextButton.y + careerMachinePerformanceNextButton.height / 2 + 7);
    ctx.textAlign = 'left'; // textAlignをリセット

    // セーブボタンの描画
    ctx.fillStyle = 'rgba(0, 180, 100, 0.8)';
    ctx.fillRect(generalSaveButton.x, generalSaveButton.y, generalSaveButton.width, generalSaveButton.height);
    ctx.fillStyle = 'white'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center';
    ctx.fillText(generalSaveButton.text, generalSaveButton.x + generalSaveButton.width / 2, generalSaveButton.y + generalSaveButton.height / 2 + 6);
    ctx.restore();

    // Draw Scrollbar for Machine Performance
    const scrollableAreaY_machine = graphAreaY;
    const scrollableAreaHeight_machine = graphAreaHeight; // Calculated earlier in this function
    const contentTotalHeight_machine = totalTeamBlockHeight * numTeams; // Calculated earlier
    const scrollParamsMachine = getScrollbarRenderParams(contentTotalHeight_machine, scrollableAreaY_machine, scrollableAreaHeight_machine, careerMachinePerformanceScrollY);
    if (scrollParamsMachine.maxScroll > 0) {
        drawScrollbar(ctx, scrollParamsMachine.x, scrollParamsMachine.trackY, scrollParamsMachine.trackHeight, scrollParamsMachine.thumbY, scrollParamsMachine.thumbHeight);
    }
}

// ====== チームオファー関連の関数 ======
function generateTeamOffers(playerRank, currentTeamTier, nextSeasonTeamTiers, playerDriverShortName, seasonPoints) { // Add playerDriverShortName and seasonPoints
    const offers = [];
    const allTeamNames = Object.keys(driverLineups);

    // シンプルなオファールール (例)
    // プレイヤーの順位と現在のティアに基づいてオファー対象のティアを決定
    let offerableTiers = [];

    // currentTeamTier はプレイヤーの「前シーズン」のチームのティア。
    // offerableTiers は、プレイヤーの成績と「前シーズン」のチームティアを考慮して決定します。
    // その後、実際にオファーを出すチームは、「新シーズン」のティアがこの offerableTiers に含まれるかでフィルタリングします。
    if (playerRank === 1) { // 優勝
        offerableTiers = [1, 2, Math.max(1, currentTeamTier -1), currentTeamTier];
    } else if (playerRank <= 3) { // トップ3
        offerableTiers = [Math.max(1, currentTeamTier -1), currentTeamTier, Math.min(5, currentTeamTier + 1), 2, 3];
    } else if (playerRank <= 10) { // トップ10
        offerableTiers = [currentTeamTier, Math.min(5, currentTeamTier + 1), 3, 4];
    } else if (playerRank <= 15) { // トップ15
        offerableTiers = [currentTeamTier, Math.min(5, currentTeamTier + 1), 4, 5];
    } else { // 16位以下
        offerableTiers = [currentTeamTier, Math.min(5, currentTeamTier + 1), 5];
    }
    // 重複を除去し、ティアの昇順にソート
    offerableTiers = [...new Set(offerableTiers)].sort((a,b) => a - b);
    console.log(`generateTeamOffers: PlayerRank=${playerRank}, PrevPlayerTeamTier=${currentTeamTier}. Offerable Tiers (based on prev season context): ${offerableTiers.join(', ')}`);

    // === NEW: プレイヤーが前シーズンに所属していたチームからのオファー判定 ===
    // キャリアモードであり、かつ前シーズンにチームに所属していた場合のみ判定
    if (careerPlayerTeamName) {
        // 成績に関わらず、現在のチームは必ずオファーリストに追加する
        if (!offers.includes(careerPlayerTeamName)) { // 既にオファーリストになければ追加
            offers.push(careerPlayerTeamName);
            console.log(`generateTeamOffers: Player's current team ${careerPlayerTeamName} guarantees a contract offer.`);
        }
    }

    allTeamNames.forEach(teamName => {
        // チームの「新シーズン」のティアを取得
        const teamNextSeasonTier = nextSeasonTeamTiers[teamName]; // 引数 nextSeasonTeamTiers を使用
        if (teamNextSeasonTier !== undefined && offerableTiers.includes(teamNextSeasonTier)) {
            offers.push(teamName);
            console.log(` > Team ${teamName} (Next Season Tier: ${teamNextSeasonTier}) matches offerable tiers. Added to offers.`);
        } else if (teamNextSeasonTier === undefined) {
            console.warn(` > Team ${teamName} has no defined next season tier in nextSeasonTeamTiers. Skipping for offer consideration.`);
        } else {
            // console.log(` > Team ${teamName} (Next Season Tier: ${teamNextSeasonTier}) does not match offerable tiers. Skipped.`);
        }
    });

    // オファーがなく、成績も振るわない場合、プレイヤーの「前シーズン」のチームの「新シーズン」でのティアより
    // 「新シーズン」で1つ下のティアのチームから1つオファーを出す試み
    if (offers.length === 0 && playerRank > 10) {
        console.log(`generateTeamOffers: No offers and playerRank > 10. Attempting fallback offer.`);
        // careerPlayerTeamName は前シーズンのプレイヤーのチーム名
        const playerPreviousTeamActualNextSeasonTier = careerPlayerTeamName ? nextSeasonTeamTiers[careerPlayerTeamName] : null;

        if (playerPreviousTeamActualNextSeasonTier !== null) {
            const targetFallbackTierInNewSeason = Math.min(5, playerPreviousTeamActualNextSeasonTier + 1);
            console.log(`generateTeamOffers: Fallback - Player's previous team (${careerPlayerTeamName}) will be Tier ${playerPreviousTeamActualNextSeasonTier} next season. Looking for teams that will be Tier ${targetFallbackTierInNewSeason} next season.`);

            const lowerTierTeamsInNewSeason = allTeamNames.filter(tn => {
                const teamNextTier = nextSeasonTeamTiers[tn]; // 各チームの「新シーズン」のティア
                return teamNextTier === targetFallbackTierInNewSeason;
            });

            if (lowerTierTeamsInNewSeason.length > 0) {
                shuffleArray(lowerTierTeamsInNewSeason);
                offers.push(lowerTierTeamsInNewSeason[0]);
                console.log(`generateTeamOffers: Fallback offer generated for ${lowerTierTeamsInNewSeason[0]} (Next Season Tier: ${nextSeasonTeamTiers[lowerTierTeamsInNewSeason[0]]}).`);
            } else {
                console.log(`generateTeamOffers: Fallback - No teams found that will be Tier ${targetFallbackTierInNewSeason} next season.`);
            }
        } else {
            console.log(`generateTeamOffers: Fallback - Could not determine player's previous team's next season tier (careerPlayerTeamName: ${careerPlayerTeamName}).`);
        }
    }

    return [...new Set(offers)]; // 最終的に重複を除去
}

function drawCareerTeamOffersScreen() {
    ctx.save();
    ctx.fillStyle = 'rgba(20, 20, 20, 0.98)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'white';
    ctx.font = 'bold 36px "Formula1 Display Wide", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`SEASON ${currentSeasonNumber} END - TEAM OFFERS (Rank: ${playerLastSeasonRank})`, canvas.width / 2, 60);
    
    const startY = 120;
    const availableHeight = canvas.height - startY - 20; // 下に20pxのマージン
    const numOffers = offeredTeams.length > 0 ? offeredTeams.length : 1;

    let buttonHeight = 50;
    let buttonPadding = 15;
    const buttonWidth = 350;

    // オファー数に応じてボタンサイズを動的に調整
    const totalRequiredHeight = numOffers * (buttonHeight + buttonPadding) - buttonPadding;
    if (totalRequiredHeight > availableHeight && numOffers > 0) {
        const totalItemHeight = availableHeight / numOffers;
        buttonHeight = totalItemHeight * 0.85; // ボタンの高さを少し大きく
        buttonPadding = totalItemHeight * 0.15; // パディングを少し小さく
    }

    if (offeredTeams.length > 0) {
        offeredTeams.forEach((teamName, index) => {
            const buttonX = canvas.width / 2 - buttonWidth / 2;
            const buttonY = startY + index * (buttonHeight + buttonPadding);
            // 来シーズンのTierを表示
            const teamTier = nextSeasonTiersForOfferDisplay[teamName] !== undefined ? nextSeasonTiersForOfferDisplay[teamName] : 'N/A';

            ctx.fillStyle = 'rgba(50, 150, 50, 0.8)'; // オファーボタンの色
            ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);

            ctx.fillStyle = 'white';
            // ボタンの高さに応じてフォントサイズを調整
            const fontSize = Math.max(12, Math.min(20, buttonHeight * 0.45));
            ctx.font = `bold ${fontSize}px Arial`;
            ctx.fillText(`${teamName} (Tier ${teamTier})`, canvas.width / 2, buttonY + buttonHeight / 2 + (fontSize / 2.5));
        });
    } else {
        ctx.fillStyle = 'orange';
        ctx.font = 'bold 24px Arial';
        ctx.fillText("No contract offers this season.", canvas.width / 2, canvas.height / 2);
        // TODO: ここに「キャリア終了」や「下位カテゴリへ」などの選択肢を出す
    }
    // generalSaveButton.isVisible はここでは設定しない (デフォルトでfalseのまま)
    // generalSaveButton.x, generalSaveButton.y も設定不要
    // 描画もメインのdraw関数に任せるか、ここでは行わない (isVisibleがfalseなので描画されない)

    ctx.textAlign = 'left'; //念のためtextAlignをリセット

    ctx.restore();
}

// Helper function to calculate next season's team tiers
function calculateNextSeasonTeamTiers(currentLineups, finishedSeasonPoints) {
    let nextSeasonTiers = {};
    let teamStandings = [];

    // Initialize nextSeasonTiers with current tiers from currentLineups
    // This ensures any team not in finishedSeasonPoints (e.g., 0 points) retains its current tier.
    for (const teamName in currentLineups) {
        nextSeasonTiers[teamName] = currentLineups[teamName].tier;
    }

    // Populate teamStandings from finishedSeasonPoints
    for (const teamName in finishedSeasonPoints) {
        // Ensure the team exists in currentLineups to avoid errors if finishedSeasonPoints has stale data
        if (currentLineups[teamName]) {
            teamStandings.push({ name: teamName, points: finishedSeasonPoints[teamName] });
        }
    }
    teamStandings.sort((a, b) => b.points - a.points); // Sort by points descending

    teamStandings.forEach((teamData, index) => {
        const rank = index + 1;
        let newTier;
        if (teamData.points >= 150) {
            newTier = 1;
        } else if (teamData.points >= 100) {
            newTier = 2;
        } else if (teamData.points >= 50) {
            newTier = 3;
        } else if (teamData.points >= 15) {
            newTier = 4;
        } else {
            newTier = 5;
        }
        nextSeasonTiers[teamData.name] = newTier; // Update with new tier
    });
    return nextSeasonTiers;
}

// ====== AIドライバー移籍処理関数 ======
function handleAiDriverTransfers(currentLineups, seasonPoints, playerChosenTeamName, playerDriverShortName, reservePool) { // Added playerDriverShortName
    let workingLineups = JSON.parse(JSON.stringify(currentLineups)); // 作業用のディープコピー
    // === 前シーズンのチームランキングに基づいてティアを更新 ===
    console.log("--- Updating Team Tiers based on Last Season's Standings ---");
    let teamStandingsForTierUpdate = [];
    for (const teamName in seasonPoints) { // グローバル変数ではなく、引数 seasonPoints を使用
        teamStandingsForTierUpdate.push({ name: teamName, points: seasonPoints[teamName] });
    }
    teamStandingsForTierUpdate.sort((a, b) => b.points - a.points); // ポイントで降順ソート
    
    teamStandingsForTierUpdate.forEach((teamData, index) => {
        const rank = index + 1;
        let newTier;
        if (teamData.points >= 150) {
            newTier = 1;
        } else if (teamData.points >= 100) {
            newTier = 2;
        } else if (teamData.points >= 50) {
            newTier = 3;
        } else if (teamData.points >= 15) {
            newTier = 4;
        } else {
            newTier = 5;
        }

        if (workingLineups[teamData.name]) {
            const oldTier = workingLineups[teamData.name].tier;
            workingLineups[teamData.name].tier = newTier;
            console.log(`Team ${teamData.name} (Rank: ${rank}, Points: ${teamData.points}) tier changed from ${oldTier} to ${newTier}`);
        }
    });
    console.log("--- Team Tier Update Complete ---");
    
    // === NEW: Apply Machine Upgrades based on Last Season's Standings ===
    console.log("--- Applying Machine Upgrades ---");
    teamStandingsForTierUpdate.forEach((teamData, index) => {
        const teamName = teamData.name;
        const rank = index + 1; // 1-based rank

        if (workingLineups[teamName]) {
            let accelDelta = 0;
            let speedDelta = 0; 
            let upgradeType = "";

            if (rank <= 6) { // Small upgrade for 1st-6th
                upgradeType = "Small";
                accelDelta = (Math.random() * (0.03 - (-0.03))) + (-0.03); // -0.03 to +0.03 
                speedDelta = (Math.random() * (0.01 - (-0.01))) + (-0.01); // -0.01 to +0.01
            } else if (rank >= 7 && rank <= (NUM_CARS / 2) ) { // Large upgrade for 7th-10th (assuming 10 teams)
                upgradeType = "Large";
                accelDelta = (Math.random() * (0.07 - (-0.05))) + (-0.05); // -0.05 to +0.07
                speedDelta = (Math.random() * (0.02 - (-0.015))) + (-0.015); // -0.015 to +0.02
            }

            if (upgradeType) { 
                const oldAccelFactor = workingLineups[teamName].accelerationFactor || 1.0;
                const oldSpeedFactor = workingLineups[teamName].maxSpeedFactor || 1.0;

                workingLineups[teamName].accelerationFactor = parseFloat((oldAccelFactor + accelDelta).toFixed(4));
                workingLineups[teamName].maxSpeedFactor = parseFloat((oldSpeedFactor + speedDelta).toFixed(4));

                console.log(`Team ${teamName} (Rank: ${rank}) received ${upgradeType} upgrade.`);
                console.log(`  Accel Factor: ${oldAccelFactor.toFixed(4)} -> ${workingLineups[teamName].accelerationFactor.toFixed(4)} (Delta: ${accelDelta.toFixed(4)})`);
                console.log(`  Max Speed Factor: ${oldSpeedFactor.toFixed(4)} -> ${workingLineups[teamName].maxSpeedFactor.toFixed(4)} (Delta: ${speedDelta.toFixed(4)})`);
            }
        }
    });
    console.log("--- Machine Upgrades Applied ---");
    
    // === NEW: Apply Regulation Change every 5 seasons ===
    // currentSeasonNumber は新しいシーズンの番号なので、(currentSeasonNumber - 1) が前のシーズン
    if (currentSeasonNumber > 1 && (currentSeasonNumber - 1) % 5 === 0) {
        console.log(`--- Applying Regulation Change for start of Season ${currentSeasonNumber} (after Season ${currentSeasonNumber - 1} ended) ---`);

        // Reset all teams' accelerationFactor and maxSpeedFactor to 1.0
        const tierPerformanceRanges = {
            1: { min: 1.00, max: 1.04 }, // Tier 1: 1.03 to 1.10
            2: { min: 0.98, max: 1.02 }, // Tier 2: 1.02 to 1.05
            3: { min: 0.96, max: 1.00 }, // Tier 3: 0.96 to 1.03
            4: { min: 0.94, max: 0.98 }, // Tier 4: 0.95 to 1.00
            5: { min: 0.92, max: 0.96 }  // Tier 5: 0.90 to 0.97
        };

        for (const teamName in workingLineups) {
            if (workingLineups.hasOwnProperty(teamName)) {
                const oldAccelFactor = workingLineups[teamName].accelerationFactor || 1.0;
                const oldSpeedFactor = workingLineups[teamName].maxSpeedFactor || 1.0;
                const teamTier = workingLineups[teamName].tier;

                const range = tierPerformanceRanges[teamTier];
                if (range) {
                    // Generate random accelerationFactor within the tier's range
                    const newAccelFactor = parseFloat((Math.random() * (range.max - range.min) + range.min).toFixed(4));
                    // Generate random maxSpeedFactor within the tier's range
                    const newSpeedFactor = parseFloat((Math.random() * (range.max - range.min) + range.min).toFixed(4));

                    workingLineups[teamName].accelerationFactor = newAccelFactor;
                    workingLineups[teamName].maxSpeedFactor = newSpeedFactor;

                    console.log(`  Team ${teamName} (Tier ${teamTier}):`);
                    console.log(`    Accel ${oldAccelFactor.toFixed(4)} -> ${newAccelFactor.toFixed(4)}`);
                    console.log(`    Speed ${oldSpeedFactor.toFixed(4)} -> ${newSpeedFactor.toFixed(4)}`);
                } else {
                    // Fallback to 1.0 if tier is not defined in ranges
                    workingLineups[teamName].accelerationFactor = 1.0;
                    workingLineups[teamName].maxSpeedFactor = 1.0;
                    console.warn(`  Team ${teamName} (Tier ${teamTier}) has no defined range. Resetting to 1.0.`);
                    console.log(`    Accel ${oldAccelFactor.toFixed(4)} -> 1.0000`);
                    console.log(`    Speed ${oldSpeedFactor.toFixed(4)} -> 1.0000`);
                }
            }    
        }
        console.log("--- Regulation Change Applied: All teams' performance factors reset to 1.0 ---");
    }
    
    // --- プレイヤーを移籍前のチームから削除 ---
    // workingLineups は前シーズンの状態なので、ここでプレイヤーの古い所属先から削除する
    let playerPreviousTeamNameForLog = null; // ログ出力用
    for (const teamNameInOldLineup in workingLineups) {
        const teamInOldLineup = workingLineups[teamNameInOldLineup];
        const playerIndexInOldTeam = teamInOldLineup.drivers.findIndex(d => d.name === playerDriverShortName);
        if (playerIndexInOldTeam !== -1) {
            playerPreviousTeamNameForLog = teamNameInOldLineup;
            teamInOldLineup.drivers.splice(playerIndexInOldTeam, 1);
            console.log(`TRANSFERS: Player ${playerDriverShortName} removed from their previous team roster: ${playerPreviousTeamNameForLog} in workingLineups.`);
            break; // プレイヤーは1チームにしかいないはず
        }
    }
    // --- プレイヤー削除ここまで ---
    // 1. 全ドライバーの情報をリスト化し、「予想レート」を計算
    let allDriverData = [];
    // Add F1 AI drivers from the previous season's lineup
    for (const teamName in workingLineups) {
        workingLineups[teamName].drivers.forEach((driver, index) => {
            if (driver.name === playerDriverShortName) {
                return;
            }
            const actualRating = driver.rating;
            const expectedRating = Math.round(actualRating + (Math.random() * 10 - 5)); // -5から+5

            allDriverData.push({
                name: driver.name,
                fullName: driver.fullName,
                rating: actualRating,
                expectedRating: expectedRating,
                aggression: driver.aggression,
                personality: driver.personality || 'standard',
                age: driver.age,
                contractYears: driver.contractYears || 1,
                salary: driver.salary,
                currentTeamName: teamName,
                currentTeamTier: workingLineups[teamName].tier,
                points: seasonPoints[driver.name] || 0,
                isPlayer: false,
                isReserveOrF2: false,
            });
        });
    }

    // F2/リザーブドライバーをallDriverDataに追加 (移籍市場の候補として)
    reservePool.forEach(rd => {
        if (rd.name === playerDriverShortName) {
            return;
        }
        if (!allDriverData.some(d => d.name === rd.name)) {
            const actualRating = rd.rating;
            const expectedRating = Math.round(actualRating + (Math.random() * 10 - 5));

            allDriverData.push({
                name: rd.name,
                fullName: rd.fullName,
                rating: actualRating,
                expectedRating: expectedRating,
                aggression: rd.aggression,
                personality: rd.personality || 'standard',
                age: rd.age,
                contractYears: rd.contractYears || 1,
                salary: rd.salary,
                currentTeamName: null,
                currentTeamTier: null,
                points: 0,
                isPlayer: false,
                isReserveOrF2: true
            });
        }
    });

    // Now, explicitly add the player to allDriverData with their current stats and new team assignment.
    const tierForPlayerNewTeam = currentLineups[playerChosenTeamName] ? currentLineups[playerChosenTeamName].tier : 5; // Default to tier 5 if team not found
    const playerActualRating = chosenPlayerInfo.rating;
    const playerExpectedRating = Math.round(playerActualRating + (Math.random() * 10 - 5));

    allDriverData.push({
        name: playerDriverShortName,
        fullName: chosenPlayerInfo.fullName,
        rating: playerActualRating,
        expectedRating: playerExpectedRating,
        aggression: chosenPlayerInfo.aggression !== undefined ? chosenPlayerInfo.aggression : carDefaults.aggression,
        personality: chosenPlayerInfo.personality || 'standard',
        age: chosenPlayerInfo.age,
        contractYears: chosenPlayerInfo.contractYears || 1,
        salary: chosenPlayerInfo.salary || calculateDriverSalary(playerActualRating),
        currentTeamName: playerChosenTeamName,
        currentTeamTier: tierForPlayerNewTeam,
        points: seasonPoints[playerDriverShortName] || 0,
        isPlayer: true,
        isReserveOrF2: false,
    });

    const RELEASE_PROBABILITY_POOR_PERFORMANCE = 0.5; // 成績不振で放出される確率 (0.7から0.5へ変更し、残留確率UP)
    const RELEASE_PROBABILITY_LOW_EXPECTED_RATING = 0.35;      // 低「予想」レーティングで放出される確率
    const LOW_EXPECTED_RATING_THRESHOLD = 75;                  // この「予想レート」以下は放出検討対象
    const DEFAULT_POOR_PERFORMANCE_THRESHOLD = 10; // Tierに設定がない場合のデフォルト値
    const POOR_PERFORMANCE_POINT_THRESHOLDS_BY_TIER = {
        1: 50, // Tier 1 チームはより高いポイントを要求
        2: 20,
        3: 10,
        4: 3,
        5: 1   // Tier 5 は低いポイントでも許容
    };

    // 1. 成績不振または低「予想」レーティングのF1 AIドライバーを確率で放出
    console.log("--- Starting AI Driver Release Phase (based on Expected Rating) ---");
    allDriverData.forEach(driver => {
        // 契約年数が2年以上のドライバーは放出対象外
        if (driver.contractYears > 1) {
            driver.contractYears--; // シーズン終了時に契約年数を1減らす
            console.log(`Driver ${driver.name} is on a multi-year contract (${driver.contractYears} years remaining). Not considered for release.`);
            return; // このドライバーの処理をスキップ
        }

        if (!driver.isPlayer && !driver.isReserveOrF2 && driver.currentTeamName) { // F1 AIドライバーであること (単年契約)
            let releaseReason = null;
            let releaseProb = 0;

            const teamTier = driver.currentTeamTier;
            const performanceThreshold = POOR_PERFORMANCE_POINT_THRESHOLDS_BY_TIER[teamTier] !== undefined ? POOR_PERFORMANCE_POINT_THRESHOLDS_BY_TIER[teamTier] : DEFAULT_POOR_PERFORMANCE_THRESHOLD;

            if (driver.points <= performanceThreshold) {
                releaseReason = "poor performance";
                releaseProb = RELEASE_PROBABILITY_POOR_PERFORMANCE;
            } else if (driver.expectedRating < LOW_EXPECTED_RATING_THRESHOLD) {
                releaseReason = "low expected rating";
                releaseProb = RELEASE_PROBABILITY_LOW_EXPECTED_RATING;
            }

            if (releaseReason && Math.random() < releaseProb) {
                console.log(`Driver ${driver.name} (Team: ${driver.currentTeamName}, Tier: ${teamTier}, Pts: ${driver.points}, ExpR: ${driver.expectedRating}, ActR: ${driver.rating}) is released due to ${releaseReason}.`);
                const teamInWorkingLineups = workingLineups[driver.currentTeamName];
                if (teamInWorkingLineups) {
                    const driverIndexInTeam = teamInWorkingLineups.drivers.findIndex(d => d.name === driver.name);
                    if (driverIndexInTeam > -1) {
                        teamInWorkingLineups.drivers.splice(driverIndexInTeam, 1);
                        console.log(` > ${driver.name} removed from workingLineups[${driver.currentTeamName}].drivers`);
                    }
                }
            } else if (releaseReason) {
                // 放出されなかった場合、契約延長処理
                console.log(`Driver ${driver.name} (Team: ${driver.currentTeamName}, Tier: ${teamTier}, Pts: ${driver.points}, ExpR: ${driver.expectedRating}, ActR: ${driver.rating}) was considered for release due to ${releaseReason} but was kept (contract extension).`);
                if (Math.random() < 0.3) { // 30%の確率で複数年契約
                    driver.contractYears = Math.floor(Math.random() * 2) + 2; // 2年または3年
                    console.log(` > Signed a new ${driver.contractYears}-year contract with ${driver.currentTeamName}.`);
                } else {
                    driver.contractYears = 1; // 単年契約
                }
            } else {
                driver.contractYears = 1; // パフォーマンスに問題なく残留する場合も単年契約更新
            }
        }
    });
    console.log("--- End AI Driver Release Phase ---");

    // --- 残留AIドライバーの契約金処理 ---
    console.log("--- Processing Salaries for Retained AI Drivers ---");
    for (const teamName in workingLineups) {
        const team = workingLineups[teamName];
        const affordableDrivers = []; // このチームが契約金を支払えるドライバーのリスト

        for (const driver of team.drivers) {
            if (driver.name === playerDriverShortName) {
                driver.contractYears = 1; // プレイヤーは常に単年契約として扱う
                affordableDrivers.push(driver); // プレイヤーは契約金0なので常に保持
                continue;
            }

            const salary = driver.salary || calculateDriverSalary(driver.rating);
            if (team.funds >= salary) {
                team.funds -= salary; // 契約金を支払う
                // 契約延長のロジックをここに追加
                const driverDataFromAll = allDriverData.find(d => d.name === driver.name);
                if (driverDataFromAll) {
                    driver.contractYears = driverDataFromAll.contractYears; // allDriverDataで計算された契約年数を反映
                    if (driver.contractYears > 1) {
                        console.log(` > ${driver.name} continues on a multi-year contract (${driver.contractYears} years).`);
                    }
                }

                affordableDrivers.push(driver); // 支払い可能なのでリストに追加
                console.log(`Retained AI: ${driver.name} (Team: ${teamName}). Salary $${salary.toLocaleString()} deducted. New funds: $${team.funds.toLocaleString()}`);
            } else {
                // チームが契約金を支払えない場合、ドライバーは放出される
                console.warn(`Team ${teamName} cannot afford salary for (otherwise retained) AI: ${driver.name} (Salary $${salary.toLocaleString()}). Releasing driver. Current team funds: $${team.funds.toLocaleString()}`);
                // affordableDrivers には追加しないことで、事実上チームから削除される
            }
        }
        team.drivers = affordableDrivers; // チームのドライバーリストを更新
    }
    console.log("--- Finished Processing Salaries for Retained AI Drivers ---");

    // 2. 補充候補ドライバーの準備 (未所属F1 AI + F2/リザーブ)
    const isDriverInTeamLineups = (driverName, lineups) => {
        for (const teamN in lineups) {
            if (lineups[teamN].drivers.some(d => d.name === driverName)) {
                return true;
            }
        }
        return false;
    };
    console.log("--- Starting AI Driver Replacement Phase (based on Expected Rating) ---");
    let replacementCandidates = allDriverData.filter(d => !d.isPlayer && !isDriverInTeamLineups(d.name, workingLineups));

    replacementCandidates.sort((a, b) => { // 予想レートでソート
        if (b.expectedRating !== a.expectedRating) return b.expectedRating - a.expectedRating;
        if (b.rating !== a.rating) return b.rating - a.rating; // 予想が同じなら実績(実際のレート)
        return a.age - b.age;
    });
    console.log("Replacement candidates (sorted by Expected Rating):", replacementCandidates.map(d => `${d.name} (ExpR:${d.expectedRating}, ActR:${d.rating}, Age:${d.age})`));

    // 3. 空きスロットへの補充
    const teamNamesSortedByTier = Object.keys(workingLineups).sort((a,b) => workingLineups[a].tier - workingLineups[b].tier);

    teamNamesSortedByTier.forEach(teamName => {
        const teamInfoFromWorking = workingLineups[teamName]; // workingLineupsから現在のチーム状況（放出後）を取得
        let currentDriverNamesInTeam = teamInfoFromWorking.drivers.map(d => d.name);

        let slotsToFillInThisTeam = 0;
        if (teamName === playerChosenTeamName) {
            // プレイヤーチームの場合、プレイヤーが1スロットを占める
            const playerIsAlreadyCounted = currentDriverNamesInTeam.includes(playerDriverShortName);
            // Player is guaranteed a spot. We need to fill 1 AI slot if it's empty.
            slotsToFillInThisTeam = 1 - teamInfoFromWorking.drivers.filter(d => d.name !== playerDriverShortName).length;
            if (!playerIsAlreadyCounted) { // If player isn't in the list (e.g. team was cleared)
                // This case should be handled by ensuring player is always in their team first.
            }
        } else {
            slotsToFillInThisTeam = 2 - currentDriverNamesInTeam.length;
        }

        console.log(`Team ${teamName} (Tier ${teamInfoFromWorking.tier}) has ${currentDriverNamesInTeam.length} drivers (${currentDriverNamesInTeam.join(', ')}), needs to fill ${slotsToFillInThisTeam} slot(s).`);

        for (let i = 0; i < slotsToFillInThisTeam && replacementCandidates.length > 0; i++) {
            let hiredForThisSlot = false;
            for (let candIdx = 0; candIdx < replacementCandidates.length; candIdx++) {
                const potentialCandidate = replacementCandidates[candIdx];
                const candidateSalary = potentialCandidate.salary || calculateDriverSalary(potentialCandidate.rating); // 契約金は実際のレートで計算

                if (teamInfoFromWorking.funds >= candidateSalary) {
                    const fundsAfterSigning = teamInfoFromWorking.funds - candidateSalary;
                    const minimumFundsToRetain = 100000; // 最低でも残す資金

                    if (fundsAfterSigning >= minimumFundsToRetain) {
                        console.log(` > Assigning ${potentialCandidate.name} (ExpR:${potentialCandidate.expectedRating}, ActR:${potentialCandidate.rating}, Sal:${candidateSalary}) to team ${teamName}. Funds: ${teamInfoFromWorking.funds.toLocaleString()} -> ${fundsAfterSigning.toLocaleString()}`);
                        teamInfoFromWorking.funds = fundsAfterSigning;
                        teamInfoFromWorking.drivers.push({
                            name: potentialCandidate.name,
                            fullName: potentialCandidate.fullName,
                            rating: potentialCandidate.rating, // 実際のレートを保存
                            aggression: potentialCandidate.aggression,
                            personality: potentialCandidate.personality || 'standard',
                            age: potentialCandidate.age,
                            contractYears: 1, // 新規契約は1年
                            salary: candidateSalary
                        });
                        replacementCandidates.splice(candIdx, 1); // Remove from candidates list
                        hiredForThisSlot = true;
                        break; // Exit candidate search loop, slot filled
                    } else {
                        console.log(` > Team ${teamName} (Funds: ${teamInfoFromWorking.funds.toLocaleString()}) can afford ${potentialCandidate.name} (Sal: ${candidateSalary.toLocaleString()}), but signing would leave less than $${minimumFundsToRetain.toLocaleString()} (Remaining: ${fundsAfterSigning.toLocaleString()}). Skipping.`);
                    }
                } else {
                    // console.log(` > Team ${teamName} cannot afford ${potentialCandidate.name} (Sal: ${candidateSalary}, Funds: ${teamInfoFromWorking.funds}). Skipping.`);
                }
            } // End of replacementCandidates loop

            if (!hiredForThisSlot) {
                console.log(` > No affordable candidate found for team ${teamName} for slot ${i + 1}.`);
            } else {
            }
        }
    });
    console.log("--- End AI Driver Replacement Phase ---");

    // 4. Player Placement Assurance & Final Lineup Construction
    // workingLineups is already being modified. Ensure player is correctly placed.
    const playerDriverInfo = allDriverData.find(d => d.isPlayer);
    if (playerDriverInfo) {
        const playerTeam = workingLineups[playerChosenTeamName];
        if (!playerTeam.drivers.some(d => d.name === playerDriverInfo.name)) {
            // Player is not in their designated team, add them.
            // If team is full with 2 AIs, one AI needs to be bumped.
            if (playerTeam.drivers.length >= 2) {
                // Bump the lowest rated AI or last added AI from player's team
                playerTeam.drivers.sort((a,b) => a.rating - b.rating); // Sort by rating ascending
                const bumpedAi = playerTeam.drivers.shift(); // Remove lowest rated
                console.log(` > Player ${playerDriverInfo.name} needs a slot in ${playerChosenTeamName}. Bumping AI ${bumpedAi.name}.`);
                // Add bumped AI back to a list of unassigned AIs if not already handled
                // For simplicity, we assume replacementCandidates can be used or a new list.
                // Here, we'll just log it. The unassigned check later should catch them.
            }
            playerTeam.drivers.push({
                name: playerDriverInfo.name, fullName: playerDriverInfo.fullName,
                rating: playerDriverInfo.rating, aggression: playerDriverInfo.aggression, personality: playerDriverInfo.personality || 'standard', age: playerDriverInfo.age,
                salary: playerDriverInfo.salary || calculateDriverSalary(playerDriverInfo.rating), contractYears: 1 // Ensure player salary and contract
            });
        }
        // Ensure player's team has at most 1 AI
        let aiInPlayerTeam = playerTeam.drivers.filter(d => d.name !== playerDriverInfo.name);
        if (aiInPlayerTeam.length > 1) {
            aiInPlayerTeam.sort((a,b) => a.rating - b.rating); // Sort AI by rating ascending
            const excessAi = aiInPlayerTeam.shift(); // Remove the lowest rated AI beyond the first one
            playerTeam.drivers = playerTeam.drivers.filter(d => d.name !== excessAi.name);
            console.log(` > Player's team ${playerChosenTeamName} had too many AIs. Removed ${excessAi.name}.`);
            // Add excessAi back to potential reserves
        }
    } else {
        console.error("CRITICAL: Player driver data not found in allDriverData during final placement.");
    }

    let finalLineups = workingLineups;

    // Defensive filtering: Ensure allDriverData does not contain undefined or null entries.
    allDriverData = allDriverData.filter(driver => driver !== undefined && driver !== null);

    // 5. 人数調整フェーズ: 各チームが2人になるように (残りの未所属AIで埋める)
    // This phase might be redundant if the previous hiring phase was thorough,
    // but it's a good safeguard.
    console.log("--- Final Team Roster Adjustment ---");
    // Re-evaluate unassigned AIs based on the current state of finalLineups
    let stillUnassignedAIs = allDriverData.filter(d => {
        if (!d) {
            console.warn("Skipping undefined driver in allDriverData.filter (stillUnassignedAIs).");
            return false;
        }
        return !d.isPlayer && !isDriverInTeamLineups(d.name, finalLineups);
    });
    stillUnassignedAIs.sort((a, b) => { // 予想レートでソート
        if (b.expectedRating !== a.expectedRating) return b.expectedRating - a.expectedRating;
        return b.rating - a.rating;
    });

    for (const teamName in finalLineups) {
        const team = finalLineups[teamName];
        // Player's team should have 1 AI slot, others 2 total slots.
        const targetDriverCount = (teamName === playerChosenTeamName && team.drivers.some(d => d.name === playerDriverShortName)) ? 2 : 2;
        let requiredSlots = targetDriverCount - team.drivers.length;

        for (let i = 0; i < requiredSlots && stillUnassignedAIs.length > 0; i++) {
            const fillerAi = stillUnassignedAIs.shift(); // 配列の先頭から取得して削除
            if (!team.drivers.some(d => d.name === fillerAi.name)) { // 重複追加を防ぐ
                const fillerSalary = fillerAi.salary || calculateDriverSalary(fillerAi.rating);
                const fundsAfterSigningFiller = team.funds - fillerSalary;
                const minimumFundsToRetainFiller = 100000; // 最低でも残す資金

                if (team.funds >= fillerSalary && fundsAfterSigningFiller >= minimumFundsToRetainFiller) {
                    team.funds = fundsAfterSigningFiller;
                    team.drivers.push({
                        name: fillerAi.name, fullName: fillerAi.fullName,
                        rating: fillerAi.rating, aggression: fillerAi.aggression, personality: fillerAi.personality || 'standard', age: fillerAi.age, // 実際のレートを保存
                        salary: fillerSalary, contractYears: 1 // 新規契約は1年
                    });
                    console.log(`Assigned still unassigned AI ${fillerAi.name} (ExpR:${fillerAi.expectedRating}, ActR:${fillerAi.rating}, Sal:${fillerSalary.toLocaleString()}) to team ${teamName}. New funds: $${team.funds.toLocaleString()}`);
                } else if (team.funds >= fillerSalary) {
                    console.log(`Team ${teamName} (Funds: ${team.funds.toLocaleString()}) can afford unassigned AI ${fillerAi.name} (Sal: ${fillerSalary.toLocaleString()}), but signing would leave less than $${minimumFundsToRetainFiller.toLocaleString()} (Remaining: ${fundsAfterSigningFiller.toLocaleString()}). Skipping. Adding back to pool.`);
                    stillUnassignedAIs.unshift(fillerAi);
                } else {
                    stillUnassignedAIs.unshift(fillerAi); // 雇えなかったのでリストの先頭に戻す (他のチームが試せるように)
                }
            } else {
                i--; // この候補は使えなかったので、次の候補のためにカウンタを戻す
            }
        }

        // 最終チェック
        if (team.drivers.length < targetDriverCount) {
            console.warn(`Team ${teamName} still has ${team.drivers.length} drivers after final adjustment (target ${targetDriverCount}). Drivers: ${team.drivers.map(d=>d.name).join(', ')}. Attempting to fill with lowest rated for free.`);
            // チームがまだドライバーを必要としている場合、利用可能な最もレートの低いドライバーを無償で雇う
            let neededToFillDesperately = targetDriverCount - team.drivers.length;
            if (neededToFillDesperately > 0 && stillUnassignedAIs.length > 0) {
                // 最も「予想レート」の低いドライバーを見つけるためにソート
                stillUnassignedAIs.sort((a, b) => {
                    if (a.expectedRating !== b.expectedRating) return a.expectedRating - b.expectedRating;
                    return a.rating - b.rating;
                });

                for (let k = 0; k < neededToFillDesperately && stillUnassignedAIs.length > 0; k++) {
                    const desperateHireAi = stillUnassignedAIs.shift(); // 最もレートの低いドライバーを取得
                    if (desperateHireAi && !team.drivers.some(d => d.name === desperateHireAi.name)) {
                        team.drivers.push({
                            name: desperateHireAi.name, fullName: desperateHireAi.fullName,
                            rating: desperateHireAi.rating, aggression: desperateHireAi.aggression, personality: desperateHireAi.personality || 'standard', age: desperateHireAi.age,
                            salary: 0, contractYears: 1 // 無償で雇用 (1年契約)
                        });
                        console.log(`DESPERATE HIRE: Team ${teamName} hired ${desperateHireAi.name} (R:${desperateHireAi.rating}) for free to fill roster. Team funds: $${team.funds.toLocaleString()}`);
                    } else if (desperateHireAi) {
                        stillUnassignedAIs.unshift(desperateHireAi); // 既にチームにいるか、問題があれば元に戻す
                        k--; // カウンターを戻す
                    }
                }
                // 次のチームの処理のために、元のソート順(高「予想」レーティング優先)に戻す
                stillUnassignedAIs.sort((a, b) => {
                    if (b.expectedRating !== b.expectedRating) return b.expectedRating - a.expectedRating;
                    return b.rating - a.rating;
                });
            }
        } else if (team.drivers.length > targetDriverCount) {
            console.error(`CRITICAL: Team ${teamName} has ${team.drivers.length} drivers! (target ${targetDriverCount}). Drivers: ${team.drivers.map(d=>d.name).join(', ')}. Logic error in assignment.`);
        }
    }

    // 6. グリッドに配置されなかったAIドライバーをリザーブプールに戻す/更新する
    console.log("--- Moving/Updating Unassigned AI Drivers in Reserve Pool ---");
    // Re-check unassigned AIs based on the final state of finalLineups
    const trulyUnassignedAIs = allDriverData.filter(driverData => {
        if (!driverData) {
            console.warn("Skipping undefined driverData in reserve pool update phase.");
            return false;
        }
        return !driverData.isPlayer && !isDriverInTeamLineups(driverData.name, finalLineups);
    });

    trulyUnassignedAIs.forEach(driverData => {
        // const wasF1DriverAtStartOfTransfer = !allDriverData.find(d => d.name === driverData.name)?.isReserveOrF2; // 移籍処理開始時点でF1ドライバーだったか
        // Check original status from allDriverData
        const originalDriverRecord = allDriverData.find(d => d.name === driverData.name);
        const wasF1DriverAtStartOfTransfer = originalDriverRecord ? !originalDriverRecord.isReserveOrF2 : false;

        if (wasF1DriverAtStartOfTransfer) {
            console.log(`Driver ${driverData.name} (Was F1, Rating: ${driverData.rating}, Age: ${driverData.age}) did not get a new F1 seat. Moving to reserves.`);
        } else {
            console.log(`Reserve/F2 Driver ${driverData.name} (Rating: ${driverData.rating}, Age: ${driverData.age}) did not get an F1 seat. Remaining in/moving to reserves.`);
        }

        const reserveDriverIndex = reserveAndF2Drivers.findIndex(reserve => reserve.name === driverData.name);
        if (reserveDriverIndex === -1) { // リザーブにまだいない場合 (元F1ドライバーなど)
            reserveAndF2Drivers.push({ name: driverData.name, fullName: driverData.fullName, rating: driverData.rating, aggression: driverData.aggression, personality: driverData.personality || 'standard', age: driverData.age, salary: driverData.salary || calculateDriverSalary(driverData.rating), contractYears: 1 });
            console.log(` > ${driverData.name} added to reserveAndF2Drivers.`);
        } else { // 既にリザーブにいる場合 (元々リザーブだったドライバーなど) は情報を更新
            reserveAndF2Drivers[reserveDriverIndex].rating = driverData.rating;
            reserveAndF2Drivers[reserveDriverIndex].age = driverData.age;
            reserveAndF2Drivers[reserveDriverIndex].aggression = driverData.aggression;
            reserveAndF2Drivers[reserveDriverIndex].contractYears = 1; // リザーブプールでは契約は1年にリセット
            reserveAndF2Drivers[reserveDriverIndex].personality = driverData.personality || 'standard';
            reserveAndF2Drivers[reserveDriverIndex].salary = driverData.salary || calculateDriverSalary(driverData.rating); // Update salary
            console.log(` > ${driverData.name} already in reserves. Updated info (Rating, Age, Aggression).`);
        }
    });
    // リザーブプールもソートしておく
    reserveAndF2Drivers.sort((a, b) => {
        if (b.rating !== a.rating) return b.rating - a.rating; // レーティング降順
        return a.age - b.age; // 年齢昇順 (若い方が優先)
    });

    return finalLineups;
}

// ====== ドライバー成長・加齢処理関数 ======
function handleDriverDevelopmentAndAging() {
    const MAX_POTENTIAL_RATING = 100;
    const MIN_GROWTH_AGE = 18;
    const PEAK_AGE_START = 26;
    const PEAK_AGE_END = 30;
    const DECLINE_AGE_START = 40 // 衰退開始年齢を少し上げる
    const BASE_GROWTH_POINTS_PER_SEASON = 3.6; // 若手の最大成長目安を1.8倍 (2.0 * 1.8)
    const F1_GROWTH_BONUS_FACTOR = 2.0; // F1所属ドライバーの成長ボーナス係数 (2倍)
    const RANDOM_GROWTH_VARIATION = 0.6; // ランダム変動幅を少し上げる
    // === 年齢による引退設定 ===
    const RETIREMENT_START_AGE = 38; // この年齢から引退の可能性が始まる
    const RETIREMENT_PROBABILITY_PER_YEAR = 0.15; // RETIREMENT_START_AGE を1年超えるごとに加算される引退確率 (例: 39歳で15%, 40歳で30%)


    const processDriver = (driver) => {
        let ratingChange = 0;
        let isF1Driver = false;
        // ドライバーがF1チームに所属しているか判定
        for (const teamName in driverLineups) {
            if (driverLineups[teamName].drivers.some(d => d.name === driver.name)) {
                isF1Driver = true;
                break;
            }
        }

        if (driver.rating >= MAX_POTENTIAL_RATING && driver.age < DECLINE_AGE_START) {
            ratingChange = 0; // 既に最大ポテンシャルなら成長しない（衰退期前）
        } else if (driver.age < PEAK_AGE_START) { // 若手
            // 年齢が若いほど、またレーティングが低いほど成長しやすい
            let potentialGain = BASE_GROWTH_POINTS_PER_SEASON *
                                ((PEAK_AGE_START - driver.age) / (PEAK_AGE_START - MIN_GROWTH_AGE)) *
                                (1 - Math.max(0, driver.rating - 60) / (MAX_POTENTIAL_RATING - 70)); // 60未満は成長しやすい
            potentialGain = Math.max(0.1, potentialGain); // 最低でも少しは成長する可能性
            ratingChange = potentialGain * (1 + (Math.random() - 0.5) * RANDOM_GROWTH_VARIATION);
            if (isF1Driver) {
                ratingChange *= F1_GROWTH_BONUS_FACTOR; // F1ドライバーなら成長ボーナス
            } else {
                // F2/リザーブの若手はF1ボーナスなし
                // ratingChange はそのまま
            }
        } else if (driver.age >= PEAK_AGE_START && driver.age <= PEAK_AGE_END) { // ピーク年齢
            ratingChange = (Math.random() - 0.4) * 1.0; // 微増または微減 (-0.4 to +0.6)
        } else if (driver.age > DECLINE_AGE_START) { // 衰退期
            ratingChange = -0.5 - (Math.random() * ((driver.age - DECLINE_AGE_START) * 0.2)); // 年齢と共に減少幅増加
        }

        if (isF1Driver && driver.age >= PEAK_AGE_START && driver.age <= PEAK_AGE_END) {
             ratingChange *= F1_GROWTH_BONUS_FACTOR; // ピーク年齢でもF1ドライバーなら成長ボーナスを適用
        }

        const oldRating = driver.rating;
        driver.rating = Math.min(MAX_POTENTIAL_RATING, Math.round(driver.rating + ratingChange)); // 最低50の制限を削除
        driver.age += 1;

        // console.log(`DEV: ${driver.fullName || driver.name} (Age: ${driver.age-1}->${driver.age}) Rating: ${oldRating}->${driver.rating} (Change: ${ratingChange.toFixed(2)})`);
    };

    // F1ドライバーの処理
    for (const teamName in driverLineups) {
        driverLineups[teamName].drivers = driverLineups[teamName].drivers.filter(driver => {
            // プレイヤーがこのスロットにいる場合はスキップ (chosenPlayerInfoで別途処理)
            if (careerPlayerTeamName === teamName && chosenPlayerInfo.driverName === driver.name) {
                return true; // プレイヤーは保持
            }
            
            processDriver(driver);

            // --- 引退判定 ---
            let retired = false;
            let retirementReason = "";

            // 1. レーティングに基づく引退
            if (driver.rating <= 50) {
                retired = true;
                retirementReason = `low rating (${driver.rating})`;
            } 
            // 2. 年齢に基づく確率での引退
            else if (driver.age >= RETIREMENT_START_AGE) {
                const yearsOverThreshold = driver.age - RETIREMENT_START_AGE;
                const retirementChance = yearsOverThreshold * RETIREMENT_PROBABILITY_PER_YEAR;
                if (Math.random() < retirementChance) {
                    retired = true;
                    retirementReason = `age (${driver.age}, chance: ${retirementChance.toFixed(2)})`;
                }
            }

            if (retired) {
                console.log(`RETIREMENT: F1 driver ${driver.fullName || driver.name} (Age: ${driver.age}, Rating: ${driver.rating}) is retiring from ${teamName} due to ${retirementReason}.`);
                return false; // チームから削除
            }
            return true; // チームに保持
        });
    }

    // F2/リザーブドライバーの処理
    reserveAndF2Drivers = reserveAndF2Drivers.filter(driver => {
        processDriver(driver);

        // --- 引退判定 (F1ドライバーと同様) ---
        let retired = false;
        let retirementReason = "";

        if (driver.rating <= 50) {
            retired = true;
            retirementReason = `low rating (${driver.rating})`;
        } else if (driver.age >= RETIREMENT_START_AGE) {
            const yearsOverThreshold = driver.age - RETIREMENT_START_AGE;
            const retirementChance = yearsOverThreshold * RETIREMENT_PROBABILITY_PER_YEAR;
            if (Math.random() < retirementChance) {
                retired = true;
                retirementReason = `age (${driver.age}, chance: ${retirementChance.toFixed(2)})`;
            }
        }

        if (retired) {
            console.log(`RETIREMENT: Reserve/F2 driver ${driver.fullName || driver.name} (Age: ${driver.age}, Rating: ${driver.rating}) is removed from the pool due to ${retirementReason}.`);
            return false; // プールから削除
        }
        return true; // プールに保持
    });

    // プレイヤーの処理 (キャリアモード時)
    if (careerPlayerTeamName && chosenPlayerInfo.driverName) {
        // console.log(`Player ${chosenPlayerInfo.fullName} (Age: ${chosenPlayerInfo.age} Rating: ${chosenPlayerInfo.rating}) is being processed for development.`);
        processDriver(chosenPlayerInfo); // chosenPlayerInfo も同じ成長ロジックを適用 (削除はしない)
    }
}

// ====== セーブ・ロード関連関数 ======
function gatherSaveData(gameStateToStore) {
    // gameStateToStore: このセーブデータがロードされた時に復帰すべき gameState
    // この関数が呼ばれる時点で、関連するグローバル変数はセーブしたい状態になっている想定
    // (例: 'all_finished' からのセーブの場合、一時的に次のシーズンの状態にグローバル変数が変更されている)

    // playerLastSeasonRank と offeredTeams は、'career_machine_performance' (特に新シーズン開始時)
    // の状態ではリセットされているべきなので、ここで調整する。
    const isNewSeasonMachinePerformance = gameStateToStore === 'career_machine_performance' && currentRaceInSeason === 1;


    return {
        saveName: `S${currentSeasonNumber} R${currentRaceInSeason} - ${chosenPlayerInfo.driverName || 'Player'} - ${new Date().toLocaleDateString()}`,
        timestamp: Date.now(),
        version: "1.0",

        currentGameState: gameStateToStore,
        currentSeasonNumber: currentSeasonNumber,
        currentRaceInSeason: currentRaceInSeason,
        currentRaceType: JSON.parse(JSON.stringify(currentRaceType)),

        chosenPlayerInfo: JSON.parse(JSON.stringify(chosenPlayerInfo)),
        careerPlayerName: JSON.parse(JSON.stringify(careerPlayerName)),
        careerPlayerTeamName: careerPlayerTeamName,

        careerDriverSeasonPoints: JSON.parse(JSON.stringify(careerDriverSeasonPoints)),
        careerTeamSeasonPoints: JSON.parse(JSON.stringify(careerTeamSeasonPoints)),
        previousRaceFinishingOrder: JSON.parse(JSON.stringify(previousRaceFinishingOrder)),
        playerLastSeasonRank: isNewSeasonMachinePerformance ? 0 : playerLastSeasonRank,
        previousSeasonPointsForDisplay: JSON.parse(JSON.stringify(previousSeasonPointsForDisplay)), // 前シーズンのポイント情報をセーブ
        offeredTeams: isNewSeasonMachinePerformance ? [] : JSON.parse(JSON.stringify(offeredTeams)),
        playerCareerHistory: JSON.parse(JSON.stringify(playerCareerHistory)),

        driverLineups: JSON.parse(JSON.stringify(driverLineups)),
        // reserveAndF2Drivers にも salary が追加されているので、そのままセーブされる
        reserveAndF2Drivers: JSON.parse(JSON.stringify(reserveAndF2Drivers)),

        ZOOM_LEVEL: ZOOM_LEVEL,

    };
}

function saveGameToSlot(slotIndex, gameData) {
    const allSavesRaw = localStorage.getItem(ALL_SAVES_KEY);
    let allSaves = [];
     if (allSavesRaw) {
        try {
            allSaves = JSON.parse(allSavesRaw);
            if (!Array.isArray(allSaves)) allSaves = [];
        } catch (e) {
            allSaves = [];
        }
    }
    // 配列の長さをMAX_SAVE_SLOTSに合わせる（不足していればnullで埋める）
    while(allSaves.length < MAX_SAVE_SLOTS) {
        allSaves.push(null);
    }
    allSaves[slotIndex] = gameData;
    try {
        localStorage.setItem(ALL_SAVES_KEY, JSON.stringify(allSaves.slice(0, MAX_SAVE_SLOTS)));
    } catch (e) {
        console.error("Error saving game to localStorage:", e);
        alert("セーブに失敗しました。ストレージの空き容量を確認してください。");
    }
}

function applyLoadedData(dataToLoad) {
    if (!dataToLoad || typeof dataToLoad !== 'object') {
        alert("ロードデータが無効です。");
        return { success: false, loadedGameState: null };
    }
    // バージョンチェック (将来的に)
    // if (dataToLoad.version !== "1.0") { alert("セーブデータのバージョンが異なります。"); return false; }

    // Do not set global gameState here. Use a local variable for internal logic.
    const internalLoadedGameState = dataToLoad.currentGameState || 'title_screen';

    currentSeasonNumber = dataToLoad.currentSeasonNumber || 1;
    currentRaceInSeason = dataToLoad.currentRaceInSeason || 1;
    currentRaceType = dataToLoad.currentRaceType ? JSON.parse(JSON.stringify(dataToLoad.currentRaceType)) : RACE_TYPES.SPRINT;

    chosenPlayerInfo = dataToLoad.chosenPlayerInfo ? JSON.parse(JSON.stringify(dataToLoad.chosenPlayerInfo)) : { driverName: null, imageName: null, teamName: null, fullName: null, rating: null, age: 18 };
    careerPlayerName = dataToLoad.careerPlayerName ? JSON.parse(JSON.stringify(dataToLoad.careerPlayerName)) : { firstName: "", lastName: "" };
    careerPlayerTeamName = dataToLoad.careerPlayerTeamName || null;

    careerDriverSeasonPoints = dataToLoad.careerDriverSeasonPoints ? JSON.parse(JSON.stringify(dataToLoad.careerDriverSeasonPoints)) : {};
    careerTeamSeasonPoints = dataToLoad.careerTeamSeasonPoints ? JSON.parse(JSON.stringify(dataToLoad.careerTeamSeasonPoints)) : {};
    previousRaceFinishingOrder = dataToLoad.previousRaceFinishingOrder ? JSON.parse(JSON.stringify(dataToLoad.previousRaceFinishingOrder)) : [];
    playerLastSeasonRank = dataToLoad.playerLastSeasonRank || 0;
    previousSeasonPointsForDisplay = dataToLoad.previousSeasonPointsForDisplay ? JSON.parse(JSON.stringify(dataToLoad.previousSeasonPointsForDisplay)) : {}; // ロード時に復元
    offeredTeams = dataToLoad.offeredTeams ? JSON.parse(JSON.stringify(dataToLoad.offeredTeams)) : [];
    playerCareerHistory = dataToLoad.playerCareerHistory ? JSON.parse(JSON.stringify(dataToLoad.playerCareerHistory)) : [];

    driverLineups = dataToLoad.driverLineups ? JSON.parse(JSON.stringify(dataToLoad.driverLineups)) : {}; // driverLineups のデフォルトは複雑なので、ロード失敗時は問題
    // reserveAndF2Drivers にも salary が含まれている想定でロード
    reserveAndF2Drivers = dataToLoad.reserveAndF2Drivers ? JSON.parse(JSON.stringify(dataToLoad.reserveAndF2Drivers)) : [];

    ZOOM_LEVEL = dataToLoad.ZOOM_LEVEL || 1.0;

    initializeRaceSettings(currentRaceInSeason);

    // ロード後の状態に応じて車の初期化を検討
    // playerCar を必要とする可能性のある状態を列挙
    const statesRequiringCarsInitialized = [
        'signal_sequence',
        'race',
        'finished',
        'all_finished',
        'replay', // リプレイも cars 配列の構造は使う
        'career_roster', // ロスター表示に cars 配列を使う
        // 'career_machine_performance' は直接 cars を使わないが、その後の遷移で必要になる場合がある
    ];

    if (statesRequiringCarsInitialized.includes(internalLoadedGameState)) {
        console.log("Calling initializeCars() after loading into state:", internalLoadedGameState);
        initializeCars(); // 重要なグローバル変数が復元された後に呼び出す
    } else if (internalLoadedGameState === 'career_machine_performance') {
        // マシンパフォーマンス画面自体は cars を直接使わないが、
        // この画面から次の画面（例：ロスター）に進む際に initializeCars が呼ばれる。
        // chosenPlayerInfo は直接ロードされるので、プレイヤー名表示は大丈夫。
        // チームのパフォーマンス表示も driverLineups からなので大丈夫。
        // ドライバーの契約金もロードされているはず。
        if (!driverLineups[Object.keys(driverLineups)[0]]?.drivers[0]?.hasOwnProperty('salary')) {
            initializeDriverSalaries(); // 古いセーブデータの場合、給与を初期化
        }
        // ここで initializeCars() を呼ばなくても、次の画面遷移で初期化される想定。
    }

    // UIボタンの表示状態をリセット（各draw関数で再設定される）
    [quickRaceButton, careerModeButton, loadGameButton, generalSaveButton,
     careerNextButton, quickRaceBackButton, careerMachinePerformanceNextButton,
     careerStartSeasonButton, replayButton, careerReplayBackButton, careerReplayAgainButton].forEach(btn => btn.isVisible = false);

    alert("ゲームをロードしました！");
    return { success: true, loadedGameState: internalLoadedGameState };
}

function loadGameFromSlot(slotIndex) {
    const allSavesRaw = localStorage.getItem(ALL_SAVES_KEY);
    if (allSavesRaw) {
        try {
            const allSaves = JSON.parse(allSavesRaw);
            if (Array.isArray(allSaves) && allSaves[slotIndex]) {
                return applyLoadedData(allSaves[slotIndex]);
            }
        } catch (e) {
            console.error("Error loading game from localStorage:", e);
        }
    }
    alert(`スロット ${slotIndex + 1} からのロードに失敗しました。`);
    return { success: false, loadedGameState: null };
}

function drawSaveLoadScreen(isSaveMode) {
    ctx.save();
    ctx.fillStyle = 'rgba(30, 30, 30, 0.95)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'white';
    ctx.font = 'bold 36px "Formula1 Display Wide", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isSaveMode ? "ゲームをセーブ" : "ゲームをロード", canvas.width / 2, 60);

    // 戻るボタン
    ctx.fillStyle = 'rgba(100, 100, 100, 0.8)';
    ctx.fillRect(backButton.x, backButton.y, backButton.width, backButton.height);
    ctx.fillStyle = 'white'; ctx.font = 'bold 18px Arial';
    ctx.fillText(backButton.text, backButton.x + backButton.width / 2, backButton.y + backButton.height / 2 + 6);

    // 「すべてのセーブデータを削除」ボタン (ロードモード時のみ)
    if (!isSaveMode) {
        deleteAllSavesButton.isVisible = true;
        deleteAllSavesButton.x = canvas.width - deleteAllSavesButton.width - 10; // 右上に配置
        deleteAllSavesButton.y = 10; // 上からのマージン

        ctx.fillStyle = 'rgba(200, 50, 50, 0.8)'; // 赤系のボタン
        ctx.fillRect(deleteAllSavesButton.x, deleteAllSavesButton.y, deleteAllSavesButton.width, deleteAllSavesButton.height);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial'; // フォントサイズ調整
        ctx.textAlign = 'center';
        ctx.fillText(deleteAllSavesButton.text, deleteAllSavesButton.x + deleteAllSavesButton.width / 2, deleteAllSavesButton.y + deleteAllSavesButton.height / 2 + 5);
    } else {
        deleteAllSavesButton.isVisible = false;
    }


    // スロット描画
    calculatedSlotWidth = (canvas.width - (SLOTS_PER_ROW + 1) * SLOT_MARGIN_X) / SLOTS_PER_ROW;
    // calculatedSlotHeight はグローバルで定義済み (80)

    for (let i = 0; i < MAX_SAVE_SLOTS; i++) {
        const slotData = saveSlotsMetadata[i];
        const col = i % SLOTS_PER_ROW;
        const row = Math.floor(i / SLOTS_PER_ROW);

        const slotX = SLOT_MARGIN_X + col * (calculatedSlotWidth + SLOT_MARGIN_X);
        const slotY = SLOT_START_Y_OFFSET + row * (calculatedSlotHeight + SLOT_MARGIN_Y);

        // マウスオーバーのハイライト
        if (currentMouseX >= slotX && currentMouseX <= slotX + calculatedSlotWidth &&
            currentMouseY >= slotY && currentMouseY <= slotY + calculatedSlotHeight) {
            ctx.fillStyle = 'rgba(80, 80, 80, 0.8)';
        } else {
            ctx.fillStyle = 'rgba(50, 50, 50, 0.8)';
        }
        ctx.fillRect(slotX, slotY, calculatedSlotWidth, calculatedSlotHeight);
        ctx.strokeStyle = 'rgba(150, 150, 150, 0.8)';
        ctx.strokeRect(slotX, slotY, calculatedSlotWidth, calculatedSlotHeight);

        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        const textYOffset = 10; // テキスト描画のYオフセット調整用

        if (slotData.isEmpty) {
            ctx.font = 'italic 18px Arial';
            ctx.fillText(`スロット ${i + 1}`, slotX + calculatedSlotWidth / 2, slotY + calculatedSlotHeight / 2 - textYOffset / 2);
            ctx.font = 'italic 16px Arial';
            ctx.fillText("(空)", slotX + calculatedSlotWidth / 2, slotY + calculatedSlotHeight / 2 + textYOffset * 1.5);
        } else {
            ctx.font = 'bold 16px Arial';
            // 名前が長すぎる場合は省略
            let displayName = slotData.name;
            if (ctx.measureText(displayName).width > calculatedSlotWidth - 10) {
                while(ctx.measureText(displayName + "...").width > calculatedSlotWidth - 10 && displayName.length > 5) {
                    displayName = displayName.slice(0, -1);
                }
                displayName += "...";
            }
            ctx.fillText(displayName, slotX + calculatedSlotWidth / 2, slotY + textYOffset + 10);
            ctx.font = '12px Arial';
            ctx.fillText(new Date(slotData.timestamp).toLocaleString(), slotX + calculatedSlotWidth / 2, slotY + calculatedSlotHeight - textYOffset - 5);
        }
    }
    ctx.restore();
}

// Generic scrollbar drawing function
function drawScrollbar(ctx, x, trackY, trackHeight, thumbActualY, thumbActualHeight) {
    // Draw Track
    ctx.fillStyle = SCROLLBAR_TRACK_COLOR;
    ctx.fillRect(x, trackY, SCROLLBAR_WIDTH, trackHeight);

    // Draw Thumb
    if (thumbActualHeight > 0 && thumbActualHeight <= trackHeight) { // Only draw thumb if it's valid
        ctx.fillStyle = SCROLLBAR_THUMB_COLOR;
        ctx.fillRect(x + 1, thumbActualY, SCROLLBAR_WIDTH - 2, thumbActualHeight); // Thumb slightly narrower for border effect
    }
}



// ====== ゲームループ ======
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}
// 全ての画像がロードされてからゲームループを開始するため、直接呼び出しはしない
// 画像のonloadコールバックで gameLoop() が呼び出されます。
// もし画像が一つも指定されていない（空の配列の場合）は、すぐにゲームループを開始
if (imagesToLoad === 0 && !allImagesLoaded) { // !allImagesLoaded を追加して重複起動を防ぐ
    checkAllImagesLoadedAndStartGame(); // gameLoopはcheckAllImagesLoadedAndStartGameから呼ばれる
}
