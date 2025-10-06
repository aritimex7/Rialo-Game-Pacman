const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';

async function getLeaderboard() {
    if (isLocal) {
        return JSON.parse(localStorage.getItem('pacmanLeaderboard') || '[]');
    } else {
        try {
            const response = await fetch('/api/get-scores');
            if (!response.ok) { return []; }
            return await response.json();
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            return [];
        }
    }
}

async function saveScore(name, score) {
    if (isLocal) {
        const leaderboard = JSON.parse(localStorage.getItem('pacmanLeaderboard') || '[]');
        leaderboard.push({ name, score });
        leaderboard.sort((a, b) => b.score - a.score);
        localStorage.setItem('pacmanLeaderboard', JSON.stringify(leaderboard));
    } else {
        try {
            await fetch('/api/submit-score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, score })
            });
        } catch (error) {
            console.error('Error submitting score:', error);
        }
    }
}

async function updateLeaderboardDisplay() {
    leaderboardList.innerHTML = '<li>Loading...</li>';
    const topScores = await getLeaderboard();
    leaderboardList.innerHTML = '';
    if (topScores.length === 0) {
        leaderboardList.innerHTML = '<li>No scores yet</li>';
    } else {
        topScores.slice(0, 7).forEach(entry => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${entry.name}</span><span>${entry.score}</span>`;
            leaderboardList.appendChild(li);
        });
    }
}

function generateMazeMap(level) {
    const width = 15; const height = 17; let map = [];
    for (let y = 0; y < height; y++) { map.push(new Array(width).fill(1)); }
    let stack = []; let startX = 1, startY = 1; map[startY][startX] = 0; stack.push([startX, startY]);
    while (stack.length > 0) {
        let [cx, cy] = stack[stack.length - 1]; let neighbors = [];
        [[0, -2], [2, 0], [0, 2], [-2, 0]].forEach(([dx, dy]) => {
            let nx = cx + dx, ny = cy + dy;
            if (ny > 0 && ny < height - 1 && nx > 0 && nx < width - 1 && map[ny][nx] === 1) { neighbors.push([nx, ny]); }
        });
        if (neighbors.length > 0) { let [nx, ny] = Phaser.Math.RND.pick(neighbors); map[ny][nx] = 0; map[cy + (ny - cy) / 2][cx + (nx - cx) / 2] = 0; stack.push([nx, ny]);
        } else { stack.pop(); }
    }
    for (let y = 1; y < height - 1; y++) { for (let x = 1; x < width - 1; x++) { if (map[y][x] === 0) {
        let wallCount = 0; let walls = [];
        if (map[y - 1][x] === 1) { wallCount++; walls.push('up'); } if (map[y + 1][x] === 1) { wallCount++; walls.push('down'); }
        if (map[y][x - 1] === 1) { wallCount++; walls.push('left'); } if (map[y][x + 1] === 1) { wallCount++; walls.push('right'); }
        if (wallCount >= 3) { const wallToBreak = Phaser.Math.RND.pick(walls);
            if (wallToBreak === 'up' && y > 1) map[y - 1][x] = 0; else if (wallToBreak === 'down' && y < height - 2) map[y + 1][x] = 0;
            else if (wallToBreak === 'left' && x > 1) map[y][x - 1] = 0; else if (wallToBreak === 'right' && x < width - 2) map[y][x + 1] = 0;
        }
    }}}
    map[height - 2][Math.floor(width / 2)] = 'P';
    map[1][1] = 'S'; map[1][width - 2] = 'S'; map[height - 2][1] = 'S'; map[height - 2][width - 2] = 'S';
    return map;
}

const usernameOverlay = document.getElementById('username-overlay');
const mainWrapper = document.getElementById('main-wrapper');
const startButton = document.getElementById('start-button');
const usernameInput = document.getElementById('username-input');
const scoreDisplay = document.getElementById('score-display');
const levelDisplay = document.getElementById('level-display');
const leaderboardList = document.getElementById('leaderboard-list');
let username = 'Player';
startButton.addEventListener('click', async () => {
    username = usernameInput.value.trim() || 'Player';
    usernameOverlay.classList.add('hidden');
    mainWrapper.style.display = 'flex';
    await updateLeaderboardDisplay();
    const game = new Phaser.Game(config);
});

class GameScene extends Phaser.Scene {
    constructor() { super({ key: 'GameScene' }); }
    init(data) { this.username = username; this.level = data.level || 1; this.score = data.score || 0; }
    preload() {
        this.load.image('player', 'asset/player.png'); this.load.image('enemy_red', 'asset/enemy_red.png'); this.load.image('enemy_blue', 'asset/enemy_blue.png');
        this.load.image('enemy_pink', 'asset/enemy_pink.png'); this.load.image('dot', 'asset/dot.png'); this.load.image('power_pellet', 'asset/power_pellet.png');
        this.load.audio('level_clear', 'asset/level_clear.wav'); this.load.audio('death', 'asset/death.wav'); this.load.audio('bgm', 'asset/bgm.wav');
    }
    create() {
        this.gameOverFlag = false; const tileSize = 32; scoreDisplay.textContent = this.score; levelDisplay.textContent = this.level;
        this.mapLayout = generateMazeMap(this.level); this.walls = this.physics.add.staticGroup(); this.dots = this.physics.add.group();
        this.powerPellets = this.physics.add.group(); this.enemies = this.physics.add.group();
        for (let row = 0; row < this.mapLayout.length; row++) { for (let col = 0; col < this.mapLayout[row].length; col++) {
            const x = col * tileSize + 16; const y = row * tileSize + 16; const tile = this.mapLayout[row][col];
            if (tile === 1) { this.walls.create(x, y, null).setSize(tileSize, tileSize).setVisible(false); }
            else if (tile === 0) { this.dots.create(x, y, 'dot'); } else if (tile === 'S') { this.powerPellets.create(x, y, 'power_pellet'); }
            else if (tile === 'P') { this.player = this.physics.add.sprite(x, y, 'player'); this.player.body.setCircle(14); }
        }}
        const numberOfEnemies = 2 + this.level; const enemyTextures = ['enemy_red', 'enemy_blue', 'enemy_pink']; const enemySpeed = 40 + (this.level * 5);
        const validSpawnPoints = [];
        for (let row = 0; row < this.mapLayout.length; row++) { for (let col = 0; col < this.mapLayout[row].length; col++) { const tile = this.mapLayout[row][col];
            if ((tile === 0 || tile === 'S') && Phaser.Math.Distance.Between(col, row, Math.floor(this.player.x / tileSize), Math.floor(this.player.y / tileSize)) > 4) { validSpawnPoints.push({ x: col, y: row }); }
        }}
        for (let i = 0; i < numberOfEnemies; i++) {
            if (validSpawnPoints.length === 0) break;
            const randomIndex = Phaser.Math.RND.between(0, validSpawnPoints.length - 1);
            const spawnPoint = validSpawnPoints.splice(randomIndex, 1)[0];
            const x = spawnPoint.x * tileSize + 16; const y = spawnPoint.y * tileSize + 16; const texture = enemyTextures[i % enemyTextures.length];
            const enemy = this.enemies.create(x, y, texture); enemy.body.setCircle(14);
            if (i >= enemyTextures.length) { enemy.setTint(Phaser.Display.Color.RandomRGB(100, 255).color); }
            enemy.currentDir = 'up'; enemy.baseSpeed = enemySpeed; enemy.setVelocity(0, -enemySpeed);
        }
        if (!this.sound.get('bgm') || !this.sound.get('bgm').isPlaying) { this.sound.play('bgm', { loop: true, volume: 0.4 }); }
        const wallColor = 0x0000FF; const graphics = this.add.graphics({ fillStyle: { color: wallColor } });
        for (let row = 0; row < this.mapLayout.length; row++) { for (let col = 0; col < this.mapLayout[row].length; col++) { if (this.mapLayout[row][col] === 1) { graphics.fillRect(col * tileSize, row * tileSize, tileSize, tileSize); } } }
        this.physics.add.collider(this.player, this.walls); this.physics.add.collider(this.enemies, this.walls);
        this.cursors = this.input.keyboard.createCursorKeys(); this.physics.add.overlap(this.player, this.dots, this.collectDot, null, this);
        this.physics.add.overlap(this.player, this.powerPellets, this.collectPowerPellet, null, this);
        this.physics.add.overlap(this.player, this.enemies, this.gameOver, null, this);
    }
    update() {
        if (this.gameOverFlag) return; const speed = 160;
        if (this.cursors.left.isDown) { this.player.setVelocityX(-speed); this.player.setVelocityY(0); }
        else if (this.cursors.right.isDown) { this.player.setVelocityX(speed); this.player.setVelocityY(0); }
        else if (this.cursors.up.isDown) { this.player.setVelocityY(-speed); this.player.setVelocityX(0); }
        else if (this.cursors.down.isDown) { this.player.setVelocityY(speed); this.player.setVelocityX(0); }
        this.enemies.children.iterate((enemy) => {
            if (enemy.body.blocked.up || enemy.body.blocked.down || enemy.body.blocked.left || enemy.body.blocked.right) {
                let d = ['up', 'down', 'left', 'right']; const o = { 'up': 'down', 'down': 'up', 'left': 'right', 'right': 'left' };
                const od = o[enemy.currentDir]; if (d.length > 1) { d = d.filter(dir => dir !== od); }
                const nd = Phaser.Math.RND.pick(d);
                if (nd === 'up') { enemy.setVelocity(0, -enemy.baseSpeed); enemy.currentDir = 'up'; }
                else if (nd === 'down') { enemy.setVelocity(0, enemy.baseSpeed); enemy.currentDir = 'down'; }
                else if (nd === 'left') { enemy.setVelocity(-enemy.baseSpeed, 0); enemy.currentDir = 'left'; }
                else if (nd === 'right') { enemy.setVelocity(enemy.baseSpeed, 0); enemy.currentDir = 'right'; }
            }
        });
    }
    collectDot(player, dot) {
        if (this.gameOverFlag) return; dot.disableBody(true, true); this.score += 10;
        scoreDisplay.textContent = this.score; if (this.dots.countActive(true) === 0 && this.powerPellets.countActive(true) === 0) { this.levelClear(); }
    }
    collectPowerPellet(player, pellet) {
        if (this.gameOverFlag) return; pellet.disableBody(true, true); this.score += 50;
        scoreDisplay.textContent = this.score; if (this.dots.countActive(true) === 0 && this.powerPellets.countActive(true) === 0) { this.levelClear(); }
    }
    levelClear() {
        this.gameOverFlag = true; this.physics.pause(); this.sound.play('level_clear');
        this.add.text(this.cameras.main.centerX, this.cameras.main.centerY - 50, `Level Clear!`, { fontSize: '40px', fill: '#FFFF00' }).setOrigin(0.5);
        const btn = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY + 50, 'CONTINUE', { fontSize: '32px', fill: '#000', backgroundColor: '#FFFF00', padding: { x: 20, y: 10 } }).setOrigin(0.5).setInteractive();
        btn.on('pointerdown', () => { this.scene.restart({ level: this.level + 1, score: this.score }); });
    }
    async gameOver(player, enemy) {
        if (this.gameOverFlag) return; this.gameOverFlag = true; this.physics.pause();
        this.sound.stopByKey('bgm'); this.sound.play('death');
        await saveScore(this.username, this.score);
        await updateLeaderboardDisplay();
        player.setTint(0xff0000);
        this.add.text(this.cameras.main.centerX, this.cameras.main.centerY - 30, 'GAME OVER', { fontSize: '48px', fill: '#FF0000' }).setOrigin(0.5);
        this.add.text(this.cameras.main.centerX, this.cameras.main.centerY + 30, 'Refresh to play again', { fontSize: '20px', fill: '#FFFFFF' }).setOrigin(0.5);
    }
}
const config = { type: Phaser.AUTO, width: 480, height: 544, parent: 'game-container', backgroundColor: '#000000', physics: { default: 'arcade', arcade: { gravity: { y: 0 } } }, scene: [GameScene]};
