const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: { debug: false } // 충돌 영역을 보고 싶다면 true로 변경
    },
    scene: { preload: preload, create: create, update: update }
};

function showTitleScreen(scene) {
    scene.physics.pause();

    // 💡 [배경 슬라이드쇼 시스템]
    // 사용할 배경 키값 배열 (튜토리얼 -> 평원 -> 밤 -> 슬라임)
    const titleBgs = ['bg_tutorial', 'bg_field', 'bg_night', 'bg_slime'];
    let bgIndex = 0;

    // baseBg는 밑바탕에 고정되어 있고, fadeBg가 그 위에서 페이드 인 되며 교체하는 정석 방식입니다.
    let baseBg = scene.add.image(400, 300, titleBgs[bgIndex]).setDepth(100).setTint(0x999999);
    baseBg.setScale(0.4);
    let fadeBg = scene.add.image(400, 300, titleBgs[bgIndex]).setDepth(101).setAlpha(0).setTint(0x999999);
    fadeBg.setScale(0.4);

    const bgTimer = scene.time.addEvent({
        delay: 4000, 
        loop: true,
        callback: () => {
            // 1. 다음 보여줄 배경 인덱스 계산
            bgIndex = (bgIndex + 1) % titleBgs.length;

            // 2. 🚨 [버그 박멸 핵심] 페이드용 이미지를 '완벽히 투명한 상태(0)'로 먼저 만든 뒤, 
            // 그 다음 텍스처를 주입합니다. 이렇게 하면 0번 배경이 유령처럼 튀어나올 틈이 없습니다.
            fadeBg.setAlpha(0);
            fadeBg.setTexture(titleBgs[bgIndex]);

            // 3. 상단 레이어(fadeBg)를 부드럽게 페이드 인 시킵니다.
            scene.tweens.add({
                targets: fadeBg,
                alpha: 1,
                duration: 1500,
                ease: 'Linear',
                onComplete: () => {
                    // 4. 페이드 인이 완벽히 끝나서 화면을 완전히 덮으면, 
                    // 밑바탕 배경(baseBg)도 몰래 다음 텍스처로 똑같이 바꿔치기합니다.
                    baseBg.setTexture(titleBgs[bgIndex]);
                    // 5. 그리고 다시 다음 턴을 위해 페이드용 이미지를 투명하게 대기시킵니다.
                    fadeBg.setAlpha(0);
                }
            });
        }
    });

    const cleanupTitleScreen = () => {
        bgTimer.destroy(); 
        scene.tweens.killTweensOf(fadeBg); // fadeBg의 트윈만 죽이면 됩니다.
        baseBg.destroy();
        fadeBg.destroy();
        titleText.destroy();
        startBtn.destroy();
        tutorialBtn.destroy();
    };
    
    // 2. 타이틀 텍스트
    const titleText = scene.add.text(400, 200, "Save the Hero!", {
        fontSize: '42px', fill: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 6, padding: { top: 10, bottom: 10 }
    }).setOrigin(0.5).setDepth(102);

    // 3. 게임 시작 버튼 (컨테이너 구조)
    const btnBg = scene.add.rectangle(0, 0, 200, 60).setFillStyle(0x4a4a4a); 
    const btnTxt = scene.add.text(0, 0, "게임 시작", { fontSize: '24px', fill: '#ffffff', fontStyle: 'bold', padding: { top: 10, bottom: 10 } }).setOrigin(0.5);
    
    const startBtn = scene.add.container(400, 400, [btnBg, btnTxt]);
    startBtn.setSize(200, 60).setInteractive().setDepth(102);

    // 버튼 호버 연출
    startBtn.on('pointerover', () => btnBg.setFillStyle(0x6a6a6a));
    startBtn.on('pointerout', () => btnBg.setFillStyle(0x4a4a4a));

    // 버튼 클릭 시 게임 시작!
    startBtn.on('pointerdown', () => {
        cleanupTitleScreen(); // 🧹 청소 실행

        isGameStarted = true;
        scene.physics.resume();
        arrangeHeroesByClass(scene);
        startFirstStage(scene); 
        updateStageBackground(scene);
    });

    // 4. 튜토리얼 버튼 (컨테이너 구조)
    const tutorialbtnBg = scene.add.rectangle(0, 0, 200, 60).setFillStyle(0x4a4a4a); // 원래 코드의 오류 수정
    const tutorialbtnTxt = scene.add.text(0, 0, "튜토리얼 시작", { fontSize: '24px', fill: '#ffffff', fontStyle: 'bold', padding: { top: 10, bottom: 10 } }).setOrigin(0.5);
    
    const tutorialBtn = scene.add.container(400, 320, [tutorialbtnBg, tutorialbtnTxt]);
    tutorialBtn.setSize(200, 60).setInteractive().setDepth(102);

    tutorialBtn.on('pointerover', () => tutorialbtnBg.setFillStyle(0x6a6a6a));
    tutorialBtn.on('pointerout', () => tutorialbtnBg.setFillStyle(0x4a4a4a));

    tutorialBtn.on('pointerdown', () => {
        cleanupTitleScreen(); // 🧹 청소 실행

        isGameStarted = true;
        scene.physics.resume();
        arrangeHeroesByClass(scene);
        startTutorialStage(scene); 
        updateStageBackground(scene);
    });
}

const game = new Phaser.Game(config);

let heroes, enemies; // 그룹 관리
let shards; // 파편 그룹
let inventory = []; // 인벤토리 배열 (최대 5칸 가정)
const INVEN_Y = 550; // 인벤토리 Y 좌표
let currentStage = 0;
let isGameOver = false;
let isChoosingReward = false;
let isRecruiting = false;
let stageText;
let projectiles; // 투사체 그룹 추가
let isGameStarted = false; // 게임 시작 여부 플래그
let currentBgImage;

//튜토리얼 구현
let tutorialStep = 0;          // 현재 튜토리얼 단계를 기록 (0이면 일반 게임)
let tutorialBox = null;        // 하단 안내창 배경 사각형
let tutorialText = null;       // 하단 안내창 텍스트 객체
let tutorialNextPrompt = null; // "클릭하여 계속" 안내 텍스트

// 클래스 목록 배열 (랜덤 추출용)
const CLASS_LIST = ['WARRIOR', 'ARCHER', 'MAGE'];

//게임 시작 버튼
function startFirstStage(scene) {
    // 1. 초기 세팅 (시작 스테이지는 0으로 둡니다. startNextStage가 호출되면서 1이 될 것입니다.)
    currentStage = 0;
    tutorialStep = 0; // 튜토리얼 플래그 확실히 해제

    // 잔상 및 기존 데이터 완전 청소
    heroes.children.iterate(hero => { if (hero && hero.statText) hero.statText.destroy(); });
    enemies.children.iterate(enemy => { if (enemy && enemy.statText) enemy.statText.destroy(); });
    heroes.clear(true, true);
    enemies.clear(true, true);
    shards.clear(true, true);

    // 2. [기획 반영] 기본 전사 1명 지급 (currentStage가 0이므로 정석 1레벨 스탯으로 소환)
    const warriorTemplate = UNIT_TEMPLATES['WARRIOR'];
    const initialWarriorStats = {
        hp: warriorTemplate.hp(0),
        atk: warriorTemplate.atk(0),
        def: warriorTemplate.def(0),
        range: warriorTemplate.range,
        speed: warriorTemplate.speed,
        as: warriorTemplate.as,
        class: warriorTemplate.class,
        scale: warriorTemplate.scale
    };
    createUnit(scene, -400, 300, 'hero_warrior', heroes, initialWarriorStats);

    // 3. 시작 영입 창 오픈 연출 (화면을 살짝 어둡게 깔고 카드를 띄웁니다)
    // 기존에 구현되어 있을 스테이지 클리어 암전창(블커) 예시
    const startMenuBg = scene.add.rectangle(400, 300, 800, 600, 0x000000, 0.6).setDepth(90);
    const subTitle = scene.add.text(400, 120, "시작 유닛을 선택하세요", { fontSize: '30px', fill: '#ddd', padding: { top: 10, bottom: 10 } }).setOrigin(0.5).setDepth(91);
    // 4. [기획 반영] 완전 랜덤으로 3개의 클래스 선정
    const randClass1 = CLASS_LIST[Math.floor(Math.random() * CLASS_LIST.length)];
    const randClass2 = CLASS_LIST[Math.floor(Math.random() * CLASS_LIST.length)];
    const randClass3 = CLASS_LIST[Math.floor(Math.random() * CLASS_LIST.length)];

    // 5. 무작위 가챠 스탯 카드로 3장 생성 (currentStage가 0이므로 1레벨 기본 베이스에 0.8~1.5배 배율 적용)
    const card1 = createHeroRecruitCard(scene, 240, 240, randClass1).setDepth(95);
    const card2 = createHeroRecruitCard(scene, 400, 240, randClass2).setDepth(95);
    const card3 = createHeroRecruitCard(scene, 560, 240, randClass3).setDepth(95);

    const firstCards = [card1, card2, card3];

    // 6. 시작 영입 카드 클릭 이벤트 바인딩
    firstCards.forEach(card => {
        card.on('pointerdown', () => {
            // 선택한 영웅 필드에 추가 (-400)
            const textureName = UNIT_TEMPLATES[card.unitClass].texture;
            createUnit(scene, -400, 300, textureName, heroes, card.finalStats);

            // 생성했던 카드들과 암전 배경 제거
            firstCards.forEach(c => c.destroy());
            startMenuBg.destroy();
            subTitle.destroy();

            // 본 게임 작동을 위해 물리 엔진을 켜고 첫 번째 스테이지 개시!
            scene.physics.resume();
            startNextStage(scene); // currentStage가 1이 되며 STAGE: 1 텍스트 갱신 및 배치 연출 가동
        });
    });
}

// 튜토리얼 시작 버튼
function createTutorialUI(scene) {
    // 이미 존재한다면 중복 생성 방지
    if (tutorialBox) return;

    // [수정] Y 좌표를 520에서 420으로 올려, 하단 인벤토리 영역(Y: 500~600)을 완벽히 비워줍니다.
    tutorialBox = scene.add.rectangle(400, 420, 760, 120, 0x000000, 0.8)
        .setStrokeStyle(2, 0xffffff)
        .setDepth(200);

    // [수정] 박스가 올라갔으므로 텍스트 시작 Y 좌표도 480에서 380으로 변경합니다.
    tutorialText = scene.add.text(60, 380, "", {
        fontSize: '18px',
        fill: '#ffffff',
        fontStyle: 'bold',
        wordWrap: { width: 680, useAdvancedWrap: true },
        padding: { top: 10, bottom: 10 }
    }).setDepth(201);

    // [수정] "클릭하여 계속" 프롬프트 Y 좌표도 555에서 455로 올립니다.
    tutorialNextPrompt = scene.add.text(740, 445, "클릭하여 계속", {
        fontSize: '14px', fill: '#aaaaaa'
    }).setOrigin(1, 0.5).setDepth(201).setVisible(false);
}

// 안내창의 텍스트를 바꾸고 클릭 대기 여부를 설정하는 유틸리티 함수
function updateTutorialMessage(message, showNextPrompt = false) {
    if (tutorialText) {
        tutorialText.setText(message);
    }
    if (tutorialNextPrompt) {
        tutorialNextPrompt.setVisible(showNextPrompt);
    }
}

function startTutorialStage(scene) {
    tutorialStep = 1; // 튜토리얼 1단계 진입
    currentStage = 0; // 튜토리얼은 0스테이지로 취급

    // [추가] 스테이지 텍스트를 'Tutorial'로 변경하고 레이어 우선순위를 최상단으로 복구
    if (stageText) {
        stageText.setText("Tutorial");
        stageText.setDepth(100); // 99로 낮췄던 depth를 다시 위로 올림
        stageText.setVisible(true); // 혹시 꺼져있다면 켜기
    }
    
    heroes.children.iterate(hero => {
        if (hero && hero.statText) hero.statText.destroy();
    });
    // 적군 스탯 텍스트 먼저 제거 후 그룹 비우기
    enemies.children.iterate(enemy => {
        if (enemy && enemy.statText) enemy.statText.destroy();
    });

    heroes.clear(true, true);
    enemies.clear(true, true);
    shards.clear(true, true);


    // 1. 하단 알림창 세팅
    createTutorialUI(scene);
    updateTutorialMessage(
        "[Save the Hero!] 튜토리얼에 오신 것을 환영합니다.\n본 게임은 아군을 강화하여 몰려오는 적을 막는 디펜스 게임입니다.", 
        true // 클릭하여 계속 프롬프트 켜기
    );

    // 2. 튜토리얼 전용 유닛 세팅 (전사 1명 배치)
    // 원래 배치 메커니즘을 타도록 x좌표를 -400으로 주어 중앙(300)으로 펼쳐지게 연출합니다.
    const warriorTemplate = UNIT_TEMPLATES['WARRIOR'];
    const initialStats = {
        hp: warriorTemplate.hp(0),
        atk: warriorTemplate.atk(0),
        def: warriorTemplate.def(0),
        range: warriorTemplate.range,
        speed: warriorTemplate.speed,
        as: warriorTemplate.as,
        class: warriorTemplate.class,
        scale: warriorTemplate.scale
    };
    
    // 아군 전사 생성 (-400에서 생성되어 arrangeHeroesByClass에 의해 정중앙 300px 라인으로 이동)
    createUnit(scene, -400, 300, 'hero_warrior', heroes, initialStats);
    arrangeHeroesByClass(scene);

    // 3. 적 슬라임 1명 배치 (오른쪽 전방에 대기)
    createUnit(scene, 600, 300, 'enemy_slime', enemies, {
        hp: 30, atk: 5, def: 10, range: 50, speed: 40, as: 1500, class: 'slime', scale:0.2
    });

    // 4. 최초 설명 페이즈 동안은 유닛들이 움직이지 않게 물리 엔진을 일시 정지해 둡니다.
    scene.physics.pause();

    // 5. 화면 전체 클릭 이벤트 리스너를 한 번만 등록하여 텍스트를 넘기도록 처리합니다.
    scene.input.once('pointerdown', () => {
        handleTutorialClick(scene);
    });
}

function handleTutorialClick(scene) {
    // 일반 게임 중이거나 튜토리얼이 끝나면 작동 안 함
    if (tutorialStep === 0) return;

    // [1단계 -> 2단계 이동]
    if (tutorialStep === 1) {
        tutorialStep = 2;
        
        // 안내 메시지 변경 및 "클릭 계속" 끄기 (전투 중에는 유저가 클릭으로 넘기면 안 되므로)
        updateTutorialMessage("전투 시스템 시연: 아군과 적군이 조우하면 자동으로 교전을 시작합니다.\n전투가 진행되는 모습을 지켜보세요.", false);

        // 일시정지를 해제하여 전사와 슬라임이 서로 걸어가서 싸우게 만듭니다.
        scene.physics.resume();
        
        // 2단계는 클릭으로 넘기는 게 아니라, '슬라임이 죽는 순간' 코드가 가로채야 하므로
        // 더 이상 once('pointerdown')을 등록하지 않고 대기합니다.
    }
    // [3단계 -> 4단계: 파편 설명 후 진짜 드래그해보기 대기 상태로 전환]
    else if (tutorialStep === 3) {
        tutorialStep = 4;
        
        // 클릭 프롬프트를 끄고 유저가 드래그 미션을 완수할 때까지 기다립니다.
        updateTutorialMessage("능력치 파편을 아군에게 넣으면 해당 수치만큼 아군의 능력치 (체력,공격력,방어력)를 상승시킵니다. \n인벤토리의 파편을 드래그하여 아군 전사(WARRIOR)에게 넣어 주세요.", false);
        
        // 4단계는 화면 아무 데나 클릭해서 넘어가는 게 아니라, 
        // 우리가 기존에 구현했던 파편 드롭 성공 함수(handleDrop)가 완료 사인을 보내야 합니다.
    }
}

function triggerTutorialRewardPhase(scene) {
    tutorialStep = 5; // 5단계 진입
    
    // 1. 알림창 안내 텍스트 갱신 (선택을 해야 하므로 클릭으로 넘어가기 프롬프트는 끕니다)
    updateTutorialMessage(
        "축하합니다! 전사의 능력치가 상승했습니다.\n스테이지 클리어 보상으로 새로운 유닛을 영입할 수 있습니다. 카드를 보고 원하는 유닛을 선택하세요.", 
        false
    );

    // 2. 고정 카드 3장 생성 (화면 중앙 부근에 나란히 배치)
    // 기존의 createHeroRecruitCard를 호출하되, 내부에서 튜토리얼용 고정 스탯을 적용하도록 만들 것입니다.
    const cardW = createHeroRecruitCard(scene, 240, 200, 'WARRIOR');
    const cardA = createHeroRecruitCard(scene, 400, 200, 'ARCHER');
    const cardM = createHeroRecruitCard(scene, 560, 200, 'MAGE');

    // 3. 카드들에 마우스를 올렸을 때(6단계: 유닛 설명)와 클릭했을 때(1스테이지 시작)의 이벤트를 바인딩합니다.
    setupTutorialCardEvents(scene, [cardW, cardA, cardM]);
}

function setupTutorialCardEvents(scene, cards) {
    const TutorialBg = scene.add.rectangle(400, 300, 800, 600, 0x000000, 0.6).setDepth(1);
    cards.forEach(card => {
        // 클래스명 추출 ('WARRIOR', 'ARCHER', 'MAGE')
        const uClass = card.unitClass; 

        // [마우스 올렸을 때 - 6단계: 각 유닛에 대한 설명 구현]
        card.on('pointerover', () => {
            if (uClass === 'WARRIOR') {
                updateTutorialMessage("전사(WARRIOR): 높은 체력과 방어력으로 최전방에서 적의 공격을 버텨내는 든든한 탱커 유닛입니다.", false);
            } else if (uClass === 'ARCHER') {
                updateTutorialMessage("궁수(ARCHER): 긴 사거리와 빠른 공격 속도로 후방에서 단일 타겟을 안정적으로 요격하는 원거리 딜러입니다.", false);
            } else if (uClass === 'MAGE') {
                updateTutorialMessage("마법사(MAGE): 공격 속도는 느리지만 강력한 범위 공격으로 적을 제압하는 원거리 딜러입니다.", false);
            }
        });

        // 마우스가 카드를 벗어나면 기본 안내문으로 복구
        card.on('pointerout', () => {
            updateTutorialMessage("카드를 보고 원하는 유닛을 선택하세요.", false);
        });

        // [카드를 클릭했을 때 - 튜토리얼 종료 및 진짜 1스테이지 개시]
        card.on('pointerdown', () => {
            // 1. 선택한 유닛 소환 정보 추출 및 필드 배치
            // 실제 유닛 생성 메커니즘 함수(예: createUnit 또는 spawnHero)를 호출하여 아군 그룹에 추가합니다.
            const textureName = UNIT_TEMPLATES[uClass].texture;
            createUnit(scene, -400, 300, textureName, heroes, card.finalStats);

            // 2. 화면에 떠 있는 3장의 영입 카드 오브젝트들을 전부 파괴하여 정리
            cards.forEach(c => c.destroy());

            updateTutorialMessage(
            "이 게임의 목표는 적을 모두 쓰러뜨리고 다음 스테이지로 넘어가는 것 입니다. \n아군이 모두 사망하면 게임 오버가 됩니다.", 
            true // 클릭하여 계속 프롬프트 켜기
            );

            scene.input.once('pointerdown', () => {
            TutorialBg.destroy();
            beforefinishTutorial(scene);
            });
        });
    });
}


function beforefinishTutorial(scene) {

            updateTutorialMessage(
            "좋습니다! 이제 본격적으로 게임을 시작해보죠!",
            true // 클릭하여 계속 프롬프트 켜기
            );

            scene.input.once('pointerdown', () => {
            finishTutorial(scene);
            });

}            

function finishTutorial(scene) {
    // 3. 튜토리얼 박스 UI 완전히 제거 (더 이상 필요 없으므로)
            if (tutorialBox) { tutorialBox.destroy(); tutorialBox = null; }
            if (tutorialText) { tutorialText.destroy(); tutorialText = null; }
            if (tutorialNextPrompt) { tutorialNextPrompt.destroy(); tutorialNextPrompt = null; }

            // 4. 튜토리얼 상태 플래그 해제 (0으로 돌려놓아야 일반 게임 규칙이 작동합니다)
            tutorialStep = 0;

            // 5. 약속된 정석 흐름! startNextStage를 호출하면 currentStage가 1이 되며 STAGE: 1이 표기되고 적들이 쏟아집니다.
            startNextStage(scene);
}

function preload() {
    // 임시 에셋 로드 (이미지가 없으면 사각형으로 대체됨)
    this.load.image('hero', 'https://labs.phaser.io/assets/sprites/phaser-dude.png');
    // --- 아군 전사 이미지 로드 ---
    this.load.image('warrior_idle', 'assets/warrior_idle.png');
    this.load.image('warrior_attack1', 'assets/warrior_attack1.png');
    this.load.image('warrior_attack2', 'assets/warrior_attack2.png');
    this.load.image('warrior_die', 'assets/warrior_die.png');
    this.load.image('warrior_moving', 'assets/warrior_moving.png');
    // --- 아군 궁수 이미지 로드 ---
    this.load.image('archer_idle', 'assets/archer_idle.png');
    this.load.image('archer_attack1', 'assets/archer_attack1.png');
    this.load.image('archer_attack2', 'assets/archer_attack2.png');
    this.load.image('archer_die', 'assets/archer_die.png');
    this.load.image('archer_moving', 'assets/archer_moving.png');
    // --- 아군 마법사 이미지 로드 ---
    this.load.image('mage_idle', 'assets/mage_idle.png');
    this.load.image('mage_attack1', 'assets/mage_attack1.png');
    this.load.image('mage_attack2', 'assets/mage_attack2.png');
    this.load.image('mage_die', 'assets/mage_die.png');
    this.load.image('mage_moving', 'assets/mage_moving.png');
    // --- 적군 슬라임(튜토리얼) 이미지 ---
    this.load.image('slime_idle', 'assets/slime_idle.gif');
    this.load.image('slime_attack1', 'assets/slime_attack1.gif');
    this.load.image('slime_attack2', 'assets/slime_attack2.gif');
    this.load.image('slime_die', 'assets/slime_die.png');
    this.load.image('slime_moving', 'assets/slime_idle.gif');
    // --- 적군 유닛 이미지 ---
    this.load.image('slime_human_idle', 'assets/slime_human_idle.png');
    this.load.image('slime_human_attack1', 'assets/slime_human_attack1.png');
    this.load.image('slime_human_attack2', 'assets/slime_human_attack2.png');
    this.load.image('slime_human_die', 'assets/slime_human_die.png');
    this.load.image('slime_human_moving', 'assets/slime_human_moving.png');
    // 투사체 이미지
    this.load.image('arrow', 'assets/projectile_arrow.png');
    this.load.image('magic_orb', 'assets/projectile_magic_orb.png');
    //클래스에 따라 다른 임시 이미지 부여하기
    this.load.image('hero_warrior', 'https://labs.phaser.io/assets/sprites/phaser-dude.png');
    this.load.image('hero_archer', 'https://labs.phaser.io/assets/sprites/phaser-dude.png');
    this.load.image('hero_mage', 'https://labs.phaser.io/assets/sprites/phaser-dude.png');
    this.load.image('enemy', 'https://labs.phaser.io/assets/sprites/clown.png');
    this.load.image('enemy_slime', 'https://labs.phaser.io/assets/sprites/clown.png');
    // 파편 에셋
    this.load.image('shard_atk', 'assets/shard_atk.png');
    this.load.image('shard_def', 'assets/shard_def.png');
    this.load.image('shard_hp', 'assets/shard_hp.png');
    // 배경 에셋
    this.load.image('bg_tutorial', 'assets/bg_tutorial.png');
    this.load.image('bg_field', 'assets/bg_field.png');
    this.load.image('bg_night', 'assets/bg_night.png');
    this.load.image('bg_slime', 'assets/bg_slime.png');
}

function create() {
    // 1. 그룹 생성 (여러 유닛을 한꺼번에 관리하기 위함)
    heroes = this.physics.add.group();
    enemies = this.physics.add.group();
    shards = this.physics.add.group(); // 파편 그룹 생성
    projectiles = this.physics.add.group();

    // [시작 화면 오버레이 트리거]
    showTitleScreen(this);

    currentBgImage = this.add.image(400, 300, 'bg_tutorial');
    currentBgImage.setScale(0.4);
    currentBgImage.setDepth(-10);

    // 하단 인벤토리 영역 배경
    this.add.rectangle(400, INVEN_Y, 800, 100, 0x333333).setDepth(-1);

    // 스테이지 UI 생성
    stageText = this.add.text(20, 20, `STAGE: ${currentStage}`, {
    fontSize: '24px',
    fill: '#ffffff',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 3
}).setDepth(99); // UI는 항상 최상단

    // 드래그 이벤트 설정
    this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
        gameObject.x = dragX;
        gameObject.y = dragY;
    });

    this.input.on('dragend', (pointer, gameObject) => {
        handleDrop(this, gameObject);
    });
}

//랜덤 요소 추가
function getRandomMultiplier(min = 0.7, max = 1.3) {
    return Math.random() * (max - min) + min;
}

// [1. 유닛 템플릿 정의: 능력치 수정 용이]
const UNIT_TEMPLATES = {
    WARRIOR: {
        texture: 'hero_warrior',
        hp: (stage) => 120 + Math.floor(15 + 3 * Math.floor(stage / 5) * stage),
        atk: (stage) => 15 + Math.floor(1 + 0.2 * Math.floor(stage/5) * stage),
        def: (stage) => 50 + Math.floor(3 + 1 * Math.floor(stage/5) * stage),
        range: 60, speed: 80, as: 1200,
        class: 'warrior',
        scale: 0.1
    },
    ARCHER: {
        texture: 'hero_archer',
        hp: (stage) => 70 + 2 * stage,
        atk: (stage) => 10 + 5 * stage,
        def: (stage) => 25 + 0.5 * stage, 
        range: 450, speed: 60, as: 1000,
        class: 'archer', projSpeed: 400,
        scale: 0.16
    },
    MAGE: {
        texture: 'hero_mage',
        hp: (stage) => 50 + 1 * stage,
        atk: (stage) => 12 + 2 * stage,
        def: (stage) => 15 + 0.2 * stage,
        range: 250, speed: 50, as: 2000,
        class: 'mage', projSpeed: 200,
        scale: 0.09
    }
};

function arrangeHeroesByClass(scene) {
    // 각 열(Column)의 X 좌표 정의
    const X_ROW = {
        warrior: 250, // 1열 (가장 앞)
        mage: 150,    // 2열 (중간)
        archer: 50    // 3열 (가장 뒤)
    };

    // 1. 각 클래스별로 '살아있는 총 유닛 수(n)'를 먼저 계산합니다.
    const totalCounts = { warrior: 0, mage: 0, archer: 0 };
    heroes.children.iterate(hero => {
        if (hero && hero.active) {
            totalCounts[hero.stats.class]++;
        }
    });

    // 2. 현재 배치 중인 유닛이 해당 클래스에서 '몇 번째(x)' 유닛인지 추적할 카운터
    const currentIndices = { warrior: 0, mage: 0, archer: 0 };

    // 3. 실제 배치 시작
    heroes.children.iterate(hero => {
        if (!hero || !hero.active) return;

        const hClass = hero.stats.class;
        const targetX = X_ROW[hClass] || 150;
        
        const n = totalCounts[hClass];       // 이 클래스의 총 유닛 수
        const x = currentIndices[hClass];   // 현재 유닛의 인덱스 (0부터 시작)

        let targetY = 300; // 기본값은 화면 중앙

        // [핵심] 제로 디비전 방지 및 기획하신 공식 대입
        if (n > 1) {
            //홀수일 경우
            if (n%2 != 0) {
                // 전달해주신 공식: y = 400/(n-1) * (x - (n-1)/2) + 300
                // 가독성과 연산 안정성을 위해 쪼개서 대입합니다.
                const spacing = 300 / (n - 1); 
                const midIndex = (n - 1) / 2;
            
                // 화면 밖으로 너무 벗어나는 것을 막기 위해 spacing의 최대폭을 제한(예: 최대 간격 80px)하고 싶다면 
                // Math.min(400 / (n - 1), 80) 형태를 취하셔도 좋습니다.
                targetY = spacing * (x - midIndex) + 250;
            }
            //짝수일 경우
            else {
                const spacing = 300 / (n); 
                const midIndex = (n-1) / 2;
            
                targetY = spacing * (x - midIndex) + 250;
            }
            
        }

        // 트윈으로 부드럽게 정렬 이동
        scene.tweens.add({
            targets: hero,
            x: targetX,
            y: targetY,
            duration: 500,
            ease: 'Cubic.out',
            onComplete: () => {
                if (typeof updateStatUI === 'function') updateStatUI(hero);
            }
        });

        currentIndices[hClass]++; // 다음 유닛을 위해 인덱스 증가
    });
}

// 극초반 아군 생성 함수(랜덤 요소 제거)
function spawnHero(scene, x, y, unitClass) {
    const template = UNIT_TEMPLATES[unitClass];

    const finalStats = {
        ...template,
        hp: Math.floor(template.hp(currentStage)),
        atk: Math.floor(template.atk(currentStage)),
        def: Math.floor(template.def(currentStage)),
        range: Math.floor(template.range),
        speed: Math.floor(template.speed),
        as: Math.floor(template.as),
        class: template.class,
        projSpeed: Math.floor(template.projSpeed || 0)
        //... 나머지 스탯들
    };

    return createUnit(scene, x, y, template.texture, heroes, finalStats);
}

// [1. 유닛 생성 함수]
function createUnit(scene, x, y, textureKey, group, stats) {
    let uClass = (stats && stats.class) ? stats.class.toLowerCase() : 'warrior';
    let finalTexture = `${uClass}_idle`;

    // 2. 만약 해당 실제 에셋이 엔진에 로드되지 않았다면 기존 임시 텍스처로 롤백
    if (!scene.textures.exists(finalTexture)) {
        finalTexture = textureKey;
    }

    // 3. 스프라이트 생성
    const unit = group.create(x, y, finalTexture);
    
    // 4. 실제 고해상도 커스텀 이미지를 사용하는 경우에만 15%로 스케일 다운
    if (unit.texture.key.includes('_idle')) {
        const targetScale = (stats && stats.scale) ? stats.scale : 0.15; // 예외 대비 기본값 0.15
        unit.setScale(targetScale);
    } else {
        unit.setScale(1.0); // 임시 사각형 등은 원본 크기 유지
    }

    unit.stats = stats;
    unit.lastAttackTime = 0;
    //직접추가) 유닛 체력바 겹칩 문제 해결. 아군이면 더 위로 올림
    let herodepth = 0
    if (group != enemies) {
        herodepth = 1
    }
    
    // 직관적인 이모지 UI (⚔️ 공격, 🛡️ 방어, ❤️ 체력)
    unit.statText = scene.add.text(x, y - 50, 
        `⚔️${stats.atk} 🛡️${stats.def} ❤️${stats.hp}`, 
        { fontSize: '14px', fill: '#fff', backgroundColor: '#000', padding: {x:4, y:2} }
    ).setOrigin(0.5).setDepth(herodepth);
    
    return unit;
}

function updateStatUI(unit) {
    unit.statText.setText(`⚔️${unit.stats.atk} 🛡️${unit.stats.def} ❤️${unit.stats.hp}`);
}

function playAttackAnimation(scene, attacker, target) {
    if (!attacker || !attacker.active || !attacker.stats) return;

    const uClass = attacker.stats.class.toLowerCase();
    const attack1Key = `${uClass}_attack1`;
    const attack2Key = `${uClass}_attack2`;
    const idleKey = `${uClass}_idle`;

    // 1. 공격 시작 이미지로 교체
    if (scene.textures.exists(attack1Key)) {
        attacker.setTexture(attack1Key);
    }

    // 2. 근접 유닛(전사/슬라임 등)은 대시 거리를 크게, 원거리는 살짝만 줌
    const direction = (target.x > attacker.x) ? 1 : -1;
    const dashDistance = (attacker.stats.range <= 60) ? 35 : 8;

    // 3. 물리 트윈 액션 실행
    scene.tweens.add({
        targets: attacker,
        x: attacker.x + (dashDistance * direction),
        duration: 120,
        yoyo: true,
        hold: 60,
        onHold: () => {
            // 돌진 정점에서 타격 순간 2번 이미지로 교체
            if (attacker.active && scene.textures.exists(attack2Key)) {
                attacker.setTexture(attack2Key);
            }
        },
        onComplete: () => {
            // 복귀 시 기본 대기 이미지로 완벽 복구
            if (attacker.active && scene.textures.exists(idleKey)) {
                attacker.setTexture(idleKey);
            }
        }
    });
}

//유닛 공격 통합 처리
// [2. 통합 공격 관리 함수]
function handleAttack(scene, attacker, target, time) {
    if (!attacker.active || !target.active) return;

    if (time > attacker.lastAttackTime + attacker.stats.as) {
        if (attacker.stats.class === 'archer' || attacker.stats.class === 'mage') {
            playAttackAnimation(scene, attacker, target)
            fireProjectile(scene, attacker, target);
        } else {
            // 전사 (근접 공격)
            playAttackAnimation(scene, attacker, target)
            applyDamage(scene, attacker, target);
        }
        attacker.lastAttackTime = time;
    }
}


// [3. 투사체 발사 함수: 궁수/마법사 통합]
function fireProjectile(scene, attacker, target) {
    // const isArcher = attacker.stats.class === 'archer';
    // const texture = isArcher ? 'arrow' : 'magic_orb';

    const uClass = attacker.stats.class.toLowerCase();
    let textureKey = '';
    let speed = 0;

    // 1. 클래스별 투사체 이미지 및 속도 지정
    if (uClass === 'archer') {
        textureKey = 'arrow';       // 궁수는 화살
        speed = attacker.stats.projSpeed;    // 화살 속도 (빠름)
    } else if (uClass === 'mage') {
        textureKey = 'magic_orb';   // 마법사는 마법 구체
        speed = attacker.stats.projSpeed;    // 마법 구체 속도 (중간)
    } else {
        return; // 전사나 근접 유닛은 투사체를 쏘지 않으므로 탈출
    }

    // 1) 생성 및 그룹 추가 (움직임Race Condition 방지)
    const proj = scene.physics.add.sprite(attacker.x, attacker.y, textureKey);
    projectiles.add(proj);

    if (textureKey == 'arrow') {
        proj.setScale(0.15);
    }
    else if (textureKey == 'magic_orb') {
        proj.setScale(0.18);
    }

    proj.stats = { ...attacker.stats }; // 발사 시점 스탯 복사
    const targetX = target.x;
    const targetY = target.y;

    // 2) 물리 엔진 이동
    scene.physics.moveTo(proj, targetX, targetY, speed);


    if (uClass === 'archer') {
        // 타겟과 궁수 사이의 각도 계산 (라디안 값)
        const angle = Phaser.Math.Angle.Between(attacker.x, attacker.y, target.x, target.y);
        proj.rotation = angle; // 화살 머리가 적을 향하도록 고정
    }

    // 3) 업데이트 로직: 도달 판정
    proj.update = () => {
        if (!proj.active) return;

        if (textureKey === 'magic_orb') {
            proj.angle += 3;
        }

       
        let dist = Phaser.Math.Distance.Between(proj.x, proj.y, targetX, targetY);
        if (dist < 15) { // 목표 도달 시
            onProjectileHit(scene, proj, targetX, targetY);
        }
    };
}


// [4. 투사체 적중 판정: 궁수 단일 / 마법사 광역]
function onProjectileHit(scene, projectile, hitX, hitY) {
    if (!projectile.active) return;
    const attackerClass = projectile.stats.class;
    
    if (attackerClass === 'mage') {
        // --- 마법사: 광역 피해 (AOE) 및 이펙트 ---
        createMageEffect(scene, hitX, hitY); // [신규] 이펙트 함수 호출

        const radius = 100;
        enemies.children.iterate(enemy => {
            if (!enemy || !enemy.active || !enemy.stats) return;
            const dist = Phaser.Math.Distance.Between(hitX, hitY, enemy.x, enemy.y);
            if (dist <= radius) {
                // 기획 공식: y = 100 - 0.7x (데미지 비율)
                let ratio = (100 - 0.7 * dist) / 100;
                if (ratio < 0) ratio = 0;
                // 2. 데미지 적용 전 한 번 더 체크 (연쇄 사망 대비)
                if (enemy && enemy.active) {
                    applyAoeDamage(scene, projectile.stats, enemy, ratio);
                }
            }
        });
    } else {
        // --- 궁수: 단일 타겟 판정 ---
        let closestEnemy = null;
        let minDist = 40;
        enemies.children.iterate(enemy => {
            if (!enemy.active) return;
            let d = Phaser.Math.Distance.Between(projectile.x, projectile.y, enemy.x, enemy.y);
            if (d < minDist) { minDist = d; closestEnemy = enemy; }
        });
        if (closestEnemy) applyDamage(scene, {stats: projectile.stats}, closestEnemy);
    }
    projectile.destroy(); // 투사체 소멸
}

// [5. [신규] 마법사 광역 이펙트 (원형) 함수]
function createMageEffect(scene, x, y) {
    // 1) 원형 그래픽 생성
    const circle = scene.add.circle(x, y, 100, 0x00ffff, 0.4);
    circle.setDepth(1); // 유닛 뒤 배경에 배치 (원하는 대로 조절)

    // 2) 트윈으로 몇 초 뒤 사라지게 연출
    scene.tweens.add({
        targets: circle,
        alpha: 0,           // 투명도를 0으로
        scale: 1.2,          // 살짝 커지면서 사라지게
        duration: 800,      // 0.8초 동안 연출
        ease: 'Cubic.out',  // 서서히 멈추는 느낌
        onComplete: () => {
            circle.destroy(); // 연출 끝나면 완전히 파괴
        }
    });
}

// [6. 데미지 적용 함수들 (쪼개기)]
function applyDamage(scene, attacker, target) {
    if (!scene || !target || !target.active || !attacker) return;
    let base_damage = Math.max(attacker.stats.atk * (100/(target.stats.def+100)), 1);
    let damage = Math.floor(base_damage);
    processDamage(scene, target, damage);
}
//데미지 공식 변경: 공격력*100/(대상 방어력+100)으로 지속적인체력소모
function applyAoeDamage(scene, attackerStats, target, ratio) {
    if (!target || !target.active) return;
    let baseDamage = Math.max(attackerStats.atk * (100/(target.stats.def+100)), 1);
    let finalDamage = Math.floor(baseDamage * ratio);
    if (finalDamage <= 0) finalDamage = 1; // 최소 1 데미지 보장
    processDamage(scene, target, finalDamage);
}

// 공통 데미지 처리 및 UI 갱신 함수
function processDamage(scene, target, damage) {
    target.stats.hp -= damage;
    updateStatUI(target);
    // scene.tweens.add({ targets: target, alpha: 0.5, duration: 50, yoyo: true });


    // 💡 [해결책] 투명도 대신 '빨간색 피격 틴트' 이펙트 적용
    // 이미 피격 트윈이 돌고 있다면 중복 연산을 방지하기 위해 기존 target 관련 트윈을 안전하게 제거할 수도 있습니다.
    // scene.tweens.killTweensOf(target); 

    // 즉시 유닛을 빨갛게 물들입니다.
    target.setTint(0x4c4c4c); 
    target.alpha = 1.0; // 혹시 기존 버그로 투명해진 유닛이 있다면 1.0으로 강제 고정

    // 0.06초 후에 다시 원래 색상(원래 틴트 없음: 0xffffff)으로 복구하는 트윈
    scene.tweens.add({
        targets: target,
        duration: 100,
        yoyo: false,
        onComplete: () => {
            if (target && target.active) {
                target.clearTint(); // 원래 고해상도 색상으로 깔끔하게 복원
            }
        }
    });
    checkUnitDeath(scene, target);
}

// 유닛 사망 처리 함수 내에 적용할 비주얼 연출
function playUnitDeathAnimation(scene, unit) {
    if (!unit || !unit.active) return;

    // UI 텍스트 컴포넌트 청소
    if (unit.statText) unit.statText.destroy();
    
    const uClass = (unit.stats && unit.stats.class) ? unit.stats.class.toLowerCase() : 'warrior';
    const dieKey = `${uClass}_die`;

    // 사망 이미지가 엔진에 존재할 때만 안전하게 변경
    if (scene.textures.exists(dieKey)) {
        unit.setTexture(dieKey);
    }

    // 바닥으로 쓰러지며 사라지는 연출 후 최종 파괴(메모리 해제)
    scene.tweens.add({
        targets: unit,
        alpha: 0.2,
        y: unit.y + 15,
        duration: 800,
        onComplete: () => {
            unit.destroy();
        }
    });
}

//유닛 사망처리
function checkUnitDeath(scene, target) {
    if (target.stats.hp <= 0) {
        // 1. 적군 사망
        if (enemies.contains(target)) {
            enemies.remove(target); 
    
            // 물리 엔진 충돌체도 완전히 꺼서 투명해지는 동안 아군과 부딪히지 않게 합니다.
            if (target.body) target.body.enable = false; 
    
            // 입력 차단
            target.disableInteractive();
            playUnitDeathAnimation(scene, target);

            // --- [튜토리얼 특수 분기] ---
            if (tutorialStep === 2) {
                tutorialStep = 3; // 3단계(파편 드랍 및 일시정지 설명 페이즈) 진입
                
                // 100% 확률로 파편을 스폰시킵니다.
                spawnShard(scene, target.x, target.y);
                
                // 유닛들이 더 이상 움직이거나 공격 동작을 취하지 않도록 물리 엔진 정지
                scene.physics.pause();

                // 하단 알림창 문구 갱신 및 유저 클릭 대기
                updateTutorialMessage(
                    "적을 처치하면 강화 아이템인 '능력치 파편'을 확률적으로 획득할 수 있습니다.\n인벤토리에 있는 파편을 마우스로 드래그하여 아군 전사에게 주세요!", 
                    true // 유저가 읽고 클릭하여 다음 행동(실전 드래그 마우스 활성화)으로 넘어가도록 유도
                );

                // 클릭 시 4단계(실전 드래그 대기)로 넘어가기 위한 일회성 이벤트 등록
                scene.input.once('pointerdown', () => {
                    handleTutorialClick(scene);
                });
                return; // 튜토리얼 분기를 탔으므로 아래의 일반 스테이지 드랍 확률 로직은 패스
            }

            // [기획 반영] 스테이지 증가에 따른 파편 드랍률 감쇠 공식
            // 1스테이지: 100%, 20스테이지: 52.5%, 35스테이지 이후: 최저 15% 마지노선 고정
            const dropRate = Math.max(1.0 - (currentStage * 0.025), 0.15);
            const randomValue = Math.random(); // 0.0 ~ 1.0 사이의 무작위 실수

            // 주사위 굴리기 성공 시에만 파편 스폰
            if (randomValue <= dropRate) {
                spawnShard(scene, target.x, target.y);
            }

            scene.time.delayedCall(10, () => {
                if (enemies.countActive() === 0 && !isChoosingReward && !isRecruiting) {
                    if (currentStage % 5 === 0) {
                    // 5, 10, 15... 스테이지라면 영입 화면을 띄움
                    triggerHeroRecruitment(scene);
                    } else {
                    // 일반 스테이지라면 보상 파편 선택
                    triggerStageClear(scene);
                    }
                    
                }
            });
        } 
        // 2. 아군 사망
        else if (heroes.contains(target)) {
            heroes.remove(target);
            if (target.body) target.body.enable = false;

            playUnitDeathAnimation(scene, target);

            // 모든 아군 유닛이 전멸했는지 검사
            if (heroes.countActive() === 0) {
                triggerGameOver(scene);
            }
        }
    }
}

// 배율에 따른 파편 텍스트 색상
function getShardColor(mult) {
    if (mult < 1.0) return '#888888';       // 하급 (회색)
    if (mult < 1.3) return '#ffffff';       // 일반 (흰색)
    if (mult < 1.7) return '#ffff00';       // 상급 (금색)
    return '#ff8800';                        // 전설 (주황색)
}
// 유닛 텍스트 색상
function getUnitColor(mult) {
    if (mult < 1.0) return '#888888';       // 하급 (회색)
    if (mult < 1.2) return '#ffffff';       // 일반 (흰색)
    if (mult < 1.4) return '#ffff00';       // 상급 (금색)
    return '#ff8800';                        // 전설 (주황색)
}

// 파편 생성 함수
function spawnShard(scene, x, y, forcedType = null, forcedValue = null, minMult = 0.7, maxMult = 1.3, forcedColor = null) {
    const types = ['ATK', 'DEF', 'HP'];
    const finalType = forcedType || types[Math.floor(Math.random() * types.length)];
    
    // 1. 기본 베이스 수치 계산
    let finalValue = forcedValue;
    let textColor = forcedColor;

    // 입력 받은 값이 없을 때(필드 드랍)
    if (finalValue === null) {
        let baseValue = 0;
        if (finalType === 'ATK') baseValue = 3 + Math.floor(currentStage / 3);
        else if (finalType === 'DEF') baseValue = 6 + Math.floor(currentStage * 1);
        else if (finalType === 'HP') baseValue = 20 + (currentStage * 5);

     // 2. 랜덤 배율 적용
    const mult = Math.random() * (maxMult - minMult) + minMult;
    // let, const를 붙이면 if문 안에서만 유효하므로 제거하기.
    finalValue = Math.max(Math.floor(baseValue * mult), 1); // 최소 1 보장
    // 3. 배율에 따른 색상 선정
    textColor = getShardColor(mult);
    }
    

    

    // 파편 컨테이너 생성 (이미지 + 텍스트)
    const texture = finalType === 'ATK' ? 'shard_atk' : (finalType === 'DEF' ? 'shard_def' : 'shard_hp');
    const shardImg = scene.add.sprite(0, 0, texture);
    const shardTxt = scene.add.text(0, 30, `${finalType} +${finalValue}`, { 
        fontSize: '16px', 
        fill: textColor,
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
    }).setOrigin(0.5);
    
    const container = scene.add.container(x, y, [shardImg, shardTxt]);
    shardImg.setScale(0.25);

  
    
    container.shardType = finalType;
    container.shardValue = finalValue; // 이 수치는 스테이지가 변해도 유지됨
    
    // 5. 자동으로 인벤토리로 이동하는 Tween 로직 (기존 성공한 코드 유지)
    const targetX = 80 + (shards.getChildren().length * 70);
    scene.tweens.add({
        targets: container,
        x: targetX,
        y: INVEN_Y,
        duration: 600,
        ease: 'Cubic.out',
        onComplete: () => {
            // 도달 완료 시점에만 드래그 및 히트박스 활성화 (에러 원천 차단)
            container.setInteractive(new Phaser.Geom.Rectangle(-30, -40, 60, 80), Phaser.Geom.Rectangle.Contains);
            scene.input.setDraggable(container);
            container.originalInvenX = targetX; 
        }
    });

    shards.add(container); // 인벤토리 관리용 일반 그룹에만 추가
    return container;

}

function collectToInventory(scene, shard) {
    shard.isCollected = true;
    scene.input.setDraggable(shard); // 인벤토리에 들어온 후에만 드래그 가능하게 설정

    // 인벤토리 내 위치 계산 (현재 인벤토리에 있는 파편 수를 세어 정렬)
    const invenX = 100 + (shards.countActive(true) * 60); 
    
    // Tween을 사용하여 부드럽게 인벤토리로 이동 (선택 사항)
    scene.tweens.add({
        targets: shard,
        x: invenX,
        y: INVEN_Y,
        duration: 300,
        ease: 'Power2'
    });
}

// 드롭 처리 (거리 기반 가까운 아군에게 부여)
function handleDrop(scene, shard) {
    // [안전장치] 보상 창이 열려있는 상태라면 유닛 탐색도 하지 말고 즉시 인벤토리로 복귀시킴
    if (isChoosingReward) {
        scene.tweens.add({
            targets: shard,
            x: shard.originalInvenX || shard.x,
            y: INVEN_Y,
            duration: 200
        });
        return; // 함수 여기서 종료 (이 아래 로직은 실행도 안 됨)
    }
    
    let closestHero = null;
    let minDist = 60;

    heroes.children.iterate(hero => {
        if (!hero.active) return;
        let dist = Phaser.Math.Distance.Between(shard.x, shard.y, hero.x, hero.y);
        if (dist < minDist) {
            minDist = dist;
            closestHero = hero;
        }
    });

    if (closestHero) {
        applyStat(closestHero, shard.shardType, shard.shardValue);
        safeDestroyShard(shard);
        
        // [튜토리얼 4단계 성공 검증 적용]
        if (tutorialStep === 4) {
            tutorialStep = 5; // 5단계(스테이지 클리어 및 유닛 선택 화면 등장 페이즈)로 진입
        
            triggerTutorialRewardPhase(scene); 
        }
    } else {
        // 원래 인벤토리 위치로 복귀 (shard에 저장해둔 원래 x값을 쓰거나 다시 계산)
        scene.tweens.add({
            targets: shard,
            x: shard.originalInvenX || shard.x, // 생성 시점에 저장해두면 좋음
            y: INVEN_Y,
            duration: 200
        });
    }
}

//파편 제거 함수 추가
function safeDestroyShard(shard) {
    if (!shard) return;
    // 이 파편이 속해있던 씬(Scene) 주소를 잠시 보관
    const scene = shard.scene; 

    shard.disableInteractive();
    shard.destroy(); // 객체 파괴 (shards 그룹에서 자동으로 제거됨)

    // 파편이 하나 사라졌으므로 뒤에 있던 파편들을 앞으로 땡겨 정렬!
    if (scene) {
        rearrangeInventory(scene);
    }
}

function applyStat(unit, type, value) {//변수 항목에 value 추가.
    if (type === 'ATK') unit.stats.atk += value;
    else if (type === 'DEF') unit.stats.def += value;
    else if (type === 'HP') unit.stats.hp += value; // 현재 체력 즉시 회복 로직 포함
    
    updateStatUI(unit);
    // 효과음이나 파티클을 넣으면 좋습니다.
}

function rearrangeInventory(scene) {
    let i = 0;
    shards.children.iterate(shard => {
        if (shard && shard.active) {
            const targetX = 80 + (i * 70);
            shard.originalInvenX = targetX; // 복귀 좌표 업데이트
            scene.tweens.add({
                targets: shard,
                x: targetX,
                duration: 200
            });
            i++;
        }
    });
}


function update(time, delta) {
    if (isGameOver) return; // 게임 오버 시 로직 중단

    // 💡 [개선 2] 모든 아군과 적군을 순회하며 이동 속도에 따른 텍스처 체인지
    const allUnits = [...heroes.getChildren(), ...enemies.getChildren()];

    allUnits.forEach(unit => {
        if (!unit || !unit.active || !unit.stats || !unit.body) return;

        const uClass = unit.stats.class.toLowerCase();
        const walkKey = `${uClass}_moving`;
        const idleKey = `${uClass}_idle`;

        // ⚔️ 공격 중이거나 사망 연출 중인 유닛은 텍스처를 건드리지 않도록 방어선 구축
        // (공격 애니메이션 도중 억지로 걷는 모션으로 바뀌는 것을 방지합니다)
        if (unit.texture.key.includes('_attack') || unit.alpha < 1) return;

        // 🏃‍♂️ 이동 속도가 0이 아닐 때 (움직이고 있을 때)
        if (Math.abs(unit.body.velocity.x) > 0.1 || Math.abs(unit.body.velocity.y) > 0.1) {
            // 엔진에 걷기 이미지가 등록되어 있고, 현재 텍스처가 걷기가 아니라면 교체!
            if (this.textures.exists(walkKey) && unit.texture.key !== walkKey) {
                unit.setTexture(walkKey);
            }
        } 
        // 🧍‍♂️ 이동 속도가 0일 때 (정지 상태일 때)
        else {
            // 엔진에 대기 이미지가 있고, 현재 텍스처가 대기가 아니라면 복구!
            if (this.textures.exists(idleKey) && unit.texture.key !== idleKey) {
                unit.setTexture(idleKey);
            }
        }
    });

    // 아군 로직
    processUnitGroup(this, heroes, enemies, time);
    // 적군 로직
    processUnitGroup(this, enemies, heroes, time);

    projectiles.children.iterate(p => {
        if (p && p.active) {
            p.update(); // 여기서 실제 이동 후 처리 로직이 실행됨
        }
    });
}

// 유닛 그룹의 행동(이동/공격)을 통합 처리하는 함수
function processUnitGroup(scene, myGroup, targetGroup, time) {
    myGroup.children.iterate(unit => {
        if (!unit || !unit.active) return;

        let closestTarget = null;
        let minDist = Infinity;

        targetGroup.children.iterate(target => {
            if (!target || !target.active) return;
            let dist = Phaser.Math.Distance.Between(unit.x, unit.y, target.x, target.y);
            if (dist < minDist) {
                minDist = dist;
                closestTarget = target;
            }
        });

        if (closestTarget) {
            let dist = Phaser.Math.Distance.Between(unit.x, unit.y, closestTarget.x, closestTarget.y);
            
            if (closestTarget && dist <= unit.stats.range) {
                unit.body.setVelocity(0);
                // 이 한 줄로 모든 클래스의 공격을 통합 관리합니다.
                handleAttack(scene, unit, closestTarget, time); 
            } else if (closestTarget) {
                scene.physics.moveToObject(unit, closestTarget, unit.stats.speed);
            }
        } else {
            unit.body.setVelocity(0); // 적이 없으면 정지
        }

        if (unit.statText) unit.statText.setPosition(unit.x, unit.y - 50);
    });
}

//투사체 청소 함수
function clearAllProjectiles() {
    if (projectiles) {
        projectiles.children.iterate(p => {
            if (p) {
                p.disableInteractive();
                p.destroy();
            }
        });
        // 그룹 내의 모든 자식을 즉시 파괴
        projectiles.clear(true, true); 
    }
}

//스테이지 클리어시 함수
function triggerStageClear(scene) {
    if (isChoosingReward) return;
    clearAllProjectiles(); // 다음 단계로 가기 전 청소
    
    isChoosingReward = true;
    scene.physics.pause();

    // 반투명 배경(오버레이)
    const overlay = scene.add.rectangle(400, 300, 800, 600, 0x000000, 0.7).setDepth(10).setInteractive();//클릭 못하도록 막음
    const title = scene.add.text(400, 150, `STAGE ${currentStage} CLEAR!`, { fontSize: '40px', fill: '#fff' }).setOrigin(0.5).setDepth(11);
    const subTitle = scene.add.text(400, 200, "보상을 선택하세요", { fontSize: '20px', fill: '#ddd' }).setOrigin(0.5).setDepth(11);

    const rewardOptions = [];
    const types = ['ATK', 'DEF', 'HP'];
    for (let i = 0; i < 3; i++) {
        const type = types[i]; // 혹은 랜덤
        const xPos = 200 + (i * 200);
        
        // 1. 기본 수치 계산
        let baseValue = (type === 'ATK') ? 4 + Math.floor(currentStage / 2) : 
                        (type === 'DEF') ? 7 + Math.floor(currentStage * 1.5) : 
                        30 + (currentStage * 7);
        // 2. 랜덤계수 (1.3~2.0)
        const mult = Math.random() * (2.0 - 1.3) + 1.3;
        const finalValue = Math.max(Math.floor(baseValue * mult), 1);
        const cardColor = getShardColor(mult);

        // 중요: spawnShard를 호출하지 않고 여기서 보상 전용 객체를 직접 만듭니다.
        const option = createRewardCard(scene, xPos, 350, type, baseValue, cardColor);
        option.setDepth(11);
        
        option.on('pointerdown', () => {
            // 1. 선택한 보상을 실제 인벤토리 파편으로 변환하여 생성
            // 이때 spawnShard를 호출하면 자동으로 인벤토리에 들어갑니다.
            spawnShard(scene, option.x, option.y, option.cardType, option.cardValue, null, null, cardColor); 

            // 2. UI 제거
            overlay.destroy();
            title.destroy();
            subTitle.destroy();
            rewardOptions.forEach(opt => opt.destroy());
            
            // 3. 다음 스테이지 시작 (약간의 시간차를 두어 파편이 인벤에 안착할 시간을 줍니다)
            scene.time.delayedCall(500, () => {
                isChoosingReward = false;
                startNextStage(scene);
            });
        });
        rewardOptions.push(option);
    }
}

// 보상 선택지 전용 비주얼 생성 함수 (자동 수집 로직 없음)
function createRewardCard(scene, x, y, type, value, color) {
    const texture = (type === 'ATK') ? 'shard_atk' : (type === 'DEF') ? 'shard_def' : 'shard_hp';
    const img = scene.add.sprite(0, 0, texture);
    // 전달받은 value, color를 화면에 표시
    const txt = scene.add.text(0, 35, `${type} +${value}`, { 
        fontSize: '18px', 
        fill: color,
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
    }).setOrigin(0.5);
    
    const container = scene.add.container(x, y, [img, txt]);
    img.setScale(0.4);
    container.setSize(100, 120);
    container.setInteractive();

    container.cardType = type;
    container.cardValue = value;
    return container;
}

function triggerHeroRecruitment(scene) {
    if (isRecruiting) return;
    clearAllProjectiles();

    isRecruiting = true;
    scene.physics.pause();

    // 뒷배경 어둡게 (블커)
    const blocker = scene.add.rectangle(400, 300, 800, 600, 0x000000, 0.7).setDepth(20);
    const title = scene.add.text(400, 100, "새로운 아군 영입", {
        fontSize: '32px', fill: '#ffffff', fontStyle: 'bold', padding: { top: 10, bottom: 10 }
    }).setOrigin(0.5).setDepth(21);

    const classes = ['WARRIOR', 'ARCHER', 'MAGE'];
    const recruitOptions = [];

    // 무작위 3명의 유닛 카드 나열
    for (let i = 0; i < 3; i++) {
        // 무작위 클래스 선정 (중복 허용 혹은 완전 랜덤)
        const randomClass = classes[Math.floor(Math.random() * classes.length)];
        const xPos = 200 + (i * 200);

        const card = createHeroRecruitCard(scene, xPos, 300, randomClass);
        card.setDepth(21);

        card.on('pointerdown', () => {
            // [수정 포인트] card.unitClass 대신 진짜 이미지 키값인 UNIT_TEMPLATES[card.unitClass].texture 를 넘겨줍니다.
            const actualTexture = UNIT_TEMPLATES[card.unitClass].texture;
            // 클릭 시 해당 랸덤 스탯을 가진 유닛 전장에 생성!
            // 기존 spawnHero를 쓰되, 이미 계산된 finalStats를 주입하도록 응용합니다.
            createUnit(scene, -400, 300, actualTexture, heroes, card.finalStats);

            // UI 청소
            blocker.destroy();
            title.destroy();
            recruitOptions.forEach(c => c.destroy());

            
            
            // 3. 다음 스테이지 시작 (약간의 시간차를 두어 파편이 인벤에 안착할 시간을 줍니다)
            scene.time.delayedCall(500, () => {
                // 상태 해제 및 물리 재개 -> 다음 스테이지 시작
                isRecruiting = false;
                startNextStage(scene); 
            });
        });
        recruitOptions.push(card);
    }
}

// 영입할 아군의 무작위 스탯을 생성하고 카드로 띄워주는 함수
function createHeroRecruitCard(scene, x, y, unitClass) {
    const template = UNIT_TEMPLATES[unitClass];

    let uClass = (template && template.class) ? template.class.toLowerCase() : 'warrior';
    let finalTexture = `${uClass}_idle`;

    // 기본 베이스 스탯 변수 선언
    let baseHp, baseAtk, baseDef;
    let mult_hp, mult_atk, mult_def;
    let unitValue

    if (tutorialStep === 5) {
        // [튜토리얼 전용] 현재 currentStage가 0이므로 스테이지 성장 부가 효과 없음 + 랜덤 배율 1.0배 고정
        baseHp = template.hp(0);
        baseAtk = template.atk(0);
        baseDef = template.def(0);
        
        mult_hp = 1.0;
        mult_atk = 1.0;
        mult_def = 1.0;
        unitValue = 2 * (1.5 * (mult_hp - 0.9) + (mult_atk - 0.8) + (mult_def - 0.8));
    } else {
        // [일반 게임용] 기존에 만들었던 스테이지 비례 + 개별 랜덤 배율 로직
        baseHp = template.hp(currentStage);
        baseAtk = template.atk(currentStage);
        baseDef = template.def(currentStage);
        
        mult_hp = Math.random() * (1.3 - 0.9) + 0.9;   
        mult_atk = Math.random() * (1.5 - 0.8) + 0.8;  
        mult_def = Math.random() * (1.5 - 0.8) + 0.8;
        // 유닛의 가치(0~4까지)
        unitValue = 2 * (1.5 * (mult_hp - 0.9) + (mult_atk - 0.8) + (mult_def - 0.8));  
    }
    
    
    
    const finalStats = {
        ...template,
        hp: Math.floor(baseHp * mult_hp), // HP 변동폭 좁게
        atk: Math.floor(baseAtk * mult_atk),
        def: Math.floor(baseDef * mult_def),
    };
    
    // ~ 1.0 1.2 1.4 ~
    const cardColor = getUnitColor(unitValue/5 + 0.8);
    const hpColor =  getUnitColor(2 * (mult_hp - 0.9) + 0.8);
    const atkColor =  getUnitColor(mult_atk);
    const defColor =  getUnitColor(mult_def);

    // 카드 배경 및 텍스트 구성
    const img = scene.add.sprite(0, 0, finalTexture);

    if (img.texture.key.includes('_idle')) {
        const targetScale = 1.5 * ((template && template.scale) ? template.scale : 0.15); // 예외 대비 기본값 0.15
            img.setScale(targetScale);
        } else {
            img.setScale(1.0); // 임시 사각형 등은 원본 크기 유지
        }

    const titleTxt = scene.add.text(0, -80, `${unitClass} (★${Math.floor(unitValue)})`, {
        fontSize: '18px', fill: cardColor, fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(2);

    // 개별 텍스트로 쪼개서 생성 (Y 좌표를 20px 간격으로 아래로 나열)
    const hpTxt = scene.add.text(0, 120, `HP: ${finalStats.hp}`, { fontSize: '18px', fill: hpColor, fontStyle: 'bold' }).setOrigin(0.5).setDepth(2);
    const atkTxt = scene.add.text(0, 140, `ATK: ${finalStats.atk}`, { fontSize: '18px', fill: atkColor, fontStyle: 'bold' }).setOrigin(0.5).setDepth(2);
    const defTxt = scene.add.text(0, 160, `DEF: ${finalStats.def}`, { fontSize: '18px', fill: defColor, fontStyle: 'bold' }).setOrigin(0.5).setDepth(2);

    const container = scene.add.container(x, y, [img, titleTxt, hpTxt, atkTxt, defTxt]);
    container.setSize(120, 180).setDepth(2);
    container.setInteractive();

    // 컨테이너에 정보 저장
    container.unitClass = unitClass;
    container.finalStats = finalStats;

    return container;
}


//다음 스테이지 시작. 아군 재정렬
function startNextStage(scene) {
    currentStage++;

    stageText.setText(`STAGE: ${currentStage}`);
    //아군 재정렬
    let i = 0;
    heroes.children.iterate(hero => {
        hero.body.setVelocity(0);
        hero.x = -400;
        hero.y = 300; // 아군 유닛들을 세로로 정렬
        updateStatUI(hero); // 다음 스테이지 시작 전 스탯 최신화
        i++;
    });

    updateStageBackground(scene);
    scene.physics.resume();
    arrangeHeroesByClass(scene);
    spawnEnemies(scene, currentStage);
}

//적 생성 함수 
function spawnEnemies(scene, currentStage) {
    const enemyCount = 1 + Math.floor(currentStage / 3);
    const enemyColumn = Math.floor(enemyCount/5);
    //const hp_coefficient = Math.floor(5 + 3 * Math.floor(currentStage / 15));
    //const atk_coefficient = Math.floor(1 + 1 * Math.floor(currentStage/15));
    //const def_coefficient = Math.floor(2 + 1 * Math.floor(currentStage/10));
    const hp_coefficient = 5;
    const atk_coefficient = 1;
    const def_coefficient = 2;

    for (let i = 0; i< enemyColumn; i++) {
        for (let j = 0; j<5; j++) {
            createUnit(scene, 600+i*30, 50 + (j * 100), 'enemy', enemies, {
            hp: 40 + Math.floor(currentStage * (hp_coefficient + 3 * i)),
            atk: 5 + Math.floor(currentStage * (atk_coefficient + 0.5 * i)),
            def: 20 + Math.floor(currentStage * (def_coefficient + 1 * i)),
            range: 50, speed: 60, as: 1500, class: 'slime',
            scale: 0.2
        });
        }
    }
    if (enemyCount<10) {
        for (let i = 0; i< (enemyCount%5); i++) {
        let array = 0
        if (i%2 == 1) {
            array = 1 + Math.floor(i/2)
        }
        else {
            array = -Math.floor(i/2)
        }
        createUnit(scene, 600 + 30*enemyColumn, 250 + 100*array, 'enemy', enemies, {
            hp: 40 + Math.floor(currentStage * (hp_coefficient + 3 * enemyColumn)),
            atk: 5 + Math.floor(currentStage * (atk_coefficient + 0.5 * enemyColumn)),
            def: 20 + Math.floor(currentStage * (def_coefficient + 1 * enemyColumn)),
            range: 50, speed: 60, as: 1500, class: 'slime',
            scale: 0.2
            });
        }
    }
    //극후반부에 등장하는 거대 슬라임 인간
    else if (currentStage >= 50 && (currentStage%10 == 0)) {
        createUnit(scene, 1000, 250, 'enemy', enemies, {
            hp: 1000 + Math.floor(currentStage * (hp_coefficient + 10 * enemyColumn)),
            atk: 200 + Math.floor(currentStage * (atk_coefficient + 5 * enemyColumn)),
            def: 200 + Math.floor(currentStage * (def_coefficient + 1 * enemyColumn)),
            range: 150, speed: 25, as: 2000, class: 'slime_human',
            scale: 0.7
        });
    }
    //30스테이지 이후부터 슬라임 인간 등장!
    else {
        for (let i = 0; i< (enemyCount%5); i++) {
        let array = 0
        if (i%2 == 1) {
            array = 1 + Math.floor(i/2)
        }
        else {
            array = -Math.floor(i/2)
        }
        createUnit(scene, 600 + 45*enemyColumn, 200 + 120*array, 'enemy', enemies, {
            hp: 100 + Math.floor(currentStage * (hp_coefficient + 5 * enemyColumn)),
            atk: 20 + Math.floor(currentStage * (atk_coefficient + 1.5 * enemyColumn)),
            def: 40 + Math.floor(currentStage * (def_coefficient + 1.3 * enemyColumn)),
            range: 80, speed: 40, as: 1100, class: 'slime_human',
            scale: 0.25
            });
        }
    }
}

function updateStageBackground(scene) {
    if (!currentBgImage) return;

    let targetTexture = 'bg_field'; // 기본값 설정

    // 💡 스테이지 조건에 따른 배경 텍스처 판정
    if (currentStage === 0) {
        targetTexture = 'bg_tutorial'; // 튜토리얼 (성벽 내부)
    } else if (currentStage >= 1 && currentStage < 30) {
        targetTexture = 'bg_field';    // 스테이지 1~29 (요새 평원)
    } else if (currentStage >= 30 && currentStage < 50) {
        targetTexture = 'bg_night';    // 스테이지 30~49 (밤의 평원)
    } else if (currentStage >= 50) {
        targetTexture = 'bg_slime';    // 스테이지 50 이상 (슬라임 본거지)
    }
    // 🚨 최적화: 이미 해당 배경이 출력 중이라면 텍스처 교체 연산을 패스합니다.
    if (currentBgImage.texture.key === targetTexture) return;

    // 새로운 배경으로 부드럽게 스위칭!
    currentBgImage.setTexture(targetTexture);
}

// [4. 게임 오버 판정]
function triggerGameOver(scene) {
    isGameOver = true;
    clearAllProjectiles(); // 다음 단계로 가기 전 청소
    scene.physics.pause();
    scene.add.rectangle(400, 300, 800, 600, 0x000000, 0.8).setDepth(20);
    scene.add.text(400, 300, 'HERO DIED...', { fontSize: '64px', fill: '#ff0000' }).setOrigin(0.5).setDepth(21);
    scene.add.text(400, 400, 'Click to Restart', { fontSize: '20px' }).setOrigin(0.5).setDepth(21);
    
    scene.input.once('pointerdown', () => {
        window.location.reload(); // 간단한 재시작 로직
    });
}