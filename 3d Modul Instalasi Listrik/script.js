// --- FISIKA & STATE ---
const SETPOINT = 12.0;
const DT = 0.05;
const INERTIA = 2.0;
const VOLT_MULT = 0.12;
const FRICTION_COEFFICIENT = 0.1;
const SETPOINT_RPM = SETPOINT / VOLT_MULT;
const FLOW_START_THRESHOLD = 30;
const DISPLAY_FLOW_SCALE = 1.5;
const TORQUE_PER_FLOW_PERCENT = 1.6;
const ELC_SLEW_RATE = 100;
const ELC_SPEED_CORRECTION = 2;
let waterFlow = parseFloat(document.getElementById('sliderWater').value) * DISPLAY_FLOW_SCALE;
let isMainLoadOn = true, mainLoadValue = 70.0, dummyLoadPWM = 0.0;

function getTurbineTorque() {
    return Math.max(0, waterFlow - FLOW_START_THRESHOLD) * TORQUE_PER_FLOW_PERCENT;
}

function getRpmWithoutDummyLoad() {
    const loadPerRpm = mainLoadValue / SETPOINT_RPM + FRICTION_COEFFICIENT;
    return Math.min(SETPOINT_RPM, getTurbineTorque() / loadPerRpm);
}

let rpm = getRpmWithoutDummyLoad();
let voltage = rpm * VOLT_MULT;

// --- DOM UI ---
const dVolt = document.getElementById('dispVolt');
const dRPM = document.getElementById('dispRPM');
const dDummy = document.getElementById('dispDummy');
const dStatus = document.getElementById('controllerStatus');
const sliderWater = document.getElementById('sliderWater');
const sliderELC = document.getElementById('sliderELC');
const btnLoad = document.getElementById('btnMainLoad');
sliderWater.oninput = e => {
    const displayedFlow = parseFloat(e.target.value);
    waterFlow = displayedFlow * DISPLAY_FLOW_SCALE;
    document.getElementById('valWaterFlow').innerText = displayedFlow + '%';
};

btnLoad.onclick = () => {
    isMainLoadOn = !isMainLoadOn;
    btnLoad.innerText = isMainLoadOn ? "Lampu Rumah: NYALA (70W)" : "Lampu Rumah: MATI (0W)";
    btnLoad.className = isMainLoadOn ? "on" : "";
    mainLoadValue = isMainLoadOn ? 70.0 : 0.0;
};

// --- THREE.JS SETUP ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f172a); // Sedikit lebih terang dari sebelumnya
scene.fog = new THREE.FogExp2(0x0f172a, 0.015); // Fog kabut malam

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(15, 25, 45); // Ditarik mundur sedikit untuk melihat panorama

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
container.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.target.set(0, 3, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2 - 0.05;

// --- LIGHTING ---
scene.add(new THREE.AmbientLight(0xffffff, 0.45)); // Ambient sedikit dinaikkan
const dirLight = new THREE.DirectionalLight(0xfff3e0, 0.9); // Cahaya bulan/senja
dirLight.position.set(30, 50, 30);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.left = -35;
dirLight.shadow.camera.right = 35;
dirLight.shadow.camera.top = 35;
dirLight.shadow.camera.bottom = -35;
scene.add(dirLight);

// --- MATERIALS ---
const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 0.9, metalness: 0.1 });
const metalMat = new THREE.MeshStandardMaterial({ color: 0x71717a, roughness: 0.5, metalness: 0.8 });
const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.7, metalness: 0.6 });
const groundMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 1.0 }); // Hijau lumut/rumput
const rockMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.8, metalness: 0.1 });
const leavesMat = new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.9 });

// --- ENVIRONMENT (Tanah & Sungai) ---
const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Jalan Setapak (Path)
const pathGeo = new THREE.PlaneGeometry(3, 30);
const pathMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 1.0 });
const pathMesh = new THREE.Mesh(pathGeo, pathMat);
pathMesh.rotation.x = -Math.PI / 2;
pathMesh.position.set(4, 0.05, 5);
pathMesh.rotation.z = Math.PI / 6;
pathMesh.receiveShadow = true;
scene.add(pathMesh);

// Sungai Dinamis
const riverGeo = new THREE.PlaneGeometry(12, 120, 32, 32);
const canvas = document.createElement('canvas');
canvas.width = 256; canvas.height = 256;
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#0ea5e9'; ctx.fillRect(0,0,256,256);
ctx.fillStyle = '#bae6fd';
for(let i=0; i<100; i++) {
    ctx.globalAlpha = Math.random() * 0.5 + 0.1;
    ctx.beginPath();
    ctx.ellipse(Math.random()*256, Math.random()*256, Math.random()*15+5, 1, 0, 0, Math.PI*2);
    ctx.fill();
}
const waterTex = new THREE.CanvasTexture(canvas);
waterTex.wrapS = THREE.RepeatWrapping;
waterTex.wrapT = THREE.RepeatWrapping;
const waterMat = new THREE.MeshStandardMaterial({ map: waterTex, color: 0x0284c7, transparent: true, opacity: 0.85, roughness: 0.1, metalness: 0.3 });
const river = new THREE.Mesh(riverGeo, waterMat);
river.rotation.x = -Math.PI / 2;
river.position.set(-15, 0.1, 0);
river.receiveShadow = true;
scene.add(river);

// Bantaran Beton
const concreteMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.9 });
const foundation1 = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 8), concreteMat);
foundation1.position.set(-19, 3, 0); foundation1.castShadow = true; foundation1.receiveShadow = true;
const foundation2 = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 8), concreteMat);
foundation2.position.set(-11, 3, 0); foundation2.castShadow = true; foundation2.receiveShadow = true;
scene.add(foundation1, foundation2);

// --- ORNAMEN: POHON, BATU, SEMAK ---
function createPineTree(x, z, scale) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 3), woodMat);
    trunk.position.y = 1.5; trunk.castShadow = true;
    const l1 = new THREE.Mesh(new THREE.ConeGeometry(2.5, 4, 8), leavesMat); l1.position.y = 4; l1.castShadow = true;
    const l2 = new THREE.Mesh(new THREE.ConeGeometry(2, 3, 8), leavesMat); l2.position.y = 6; l2.castShadow = true;
    const l3 = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.5, 8), leavesMat); l3.position.y = 7.5; l3.castShadow = true;
    tree.add(trunk, l1, l2, l3);
    tree.position.set(x, 0, z);
    tree.scale.set(scale, scale, scale);
    scene.add(tree);
}
createPineTree(-25, -20, 1.5);
createPineTree(-32, 15, 1.2);
createPineTree(25, -25, 1.8);
createPineTree(35, 10, 1.4);
createPineTree(5, -28, 1.1);
createPineTree(-25, 30, 1.6);
createPineTree(28, 25, 1.3);

function createRock(x, y, z, s) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), rockMat);
    rock.position.set(x, y, z);
    rock.scale.set(s, s*0.7, s*1.2);
    rock.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, 0);
    rock.castShadow = true; rock.receiveShadow = true;
    scene.add(rock);
}
createRock(-9, 0.5, -5, 1.5);
createRock(-9, 0.3, -15, 2);
createRock(-21, 0.6, 8, 1.8);
createRock(-22, 0.4, 20, 2.5);
createRock(-8, 0.2, 25, 1.2);
createRock(8, 0.5, -8, 1.3);

function createBush(x, z, s) {
    const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), leavesMat);
    bush.position.set(x, 0.5, z);
    bush.scale.set(s, s*0.8, s);
    bush.castShadow = true;
    scene.add(bush);
}
createBush(12, 1, 1.5);
createBush(18, -2, 1.2);
createBush(-3, 6, 1.8);
createBush(-6, 9, 1.1);

// --- WATER WHEEL (Kincir Holow) ---
const wheelGroup = new THREE.Group();
wheelGroup.position.set(-15, 4.5, 0);
const rimGeo = new THREE.TorusGeometry(4.5, 0.2, 16, 64);
const rim1 = new THREE.Mesh(rimGeo, woodMat); rim1.rotation.y = Math.PI/2; rim1.position.x = -1.2; rim1.castShadow = true;
const rim2 = new THREE.Mesh(rimGeo, woodMat); rim2.rotation.y = Math.PI/2; rim2.position.x = 1.2; rim2.castShadow = true;
wheelGroup.add(rim1, rim2);

for(let i=0; i<12; i++) {
    const angle = (i/12) * Math.PI * 2;
    const spokeGeo = new THREE.CylinderGeometry(0.1, 0.1, 9);
    const spoke1 = new THREE.Mesh(spokeGeo, woodMat); spoke1.position.set(-1.2, 0, 0); spoke1.rotation.set(angle, 0, Math.PI/2, 'ZXY');
    const spoke2 = spoke1.clone(); spoke2.position.set(1.2, 0, 0);
    const paddle = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 1.8), woodMat);
    paddle.position.set(0, Math.cos(angle)*4.5, Math.sin(angle)*4.5);
    paddle.rotation.x = -angle;
    paddle.castShadow = true;
    wheelGroup.add(spoke1, spoke2, paddle);
}

const wheelShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 10), metalMat);
wheelShaft.rotation.z = Math.PI / 2; wheelShaft.castShadow = true;
wheelGroup.add(wheelShaft);
const pulley1 = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.5, 32), darkMetalMat);
pulley1.rotation.z = Math.PI / 2; pulley1.position.x = 3.5; pulley1.castShadow = true;
wheelGroup.add(pulley1);
scene.add(wheelGroup);

// --- GENERATOR ---
const genGroup = new THREE.Group();
genGroup.position.set(-6, 4.5, 0); 
const genBody = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 3.5, 32), darkMetalMat);
genBody.rotation.z = Math.PI / 2; genBody.castShadow = true;
genGroup.add(genBody);

for(let x = -1.2; x <= 1.2; x += 0.3) {
    const fin = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.1, 32), darkMetalMat);
    fin.rotation.z = Math.PI / 2; fin.position.x = x; fin.castShadow = true;
    genGroup.add(fin);
}

const genMount = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1, 1.8), darkMetalMat);
genMount.position.set(0, -1.2, 0); genMount.castShadow = true; genGroup.add(genMount);
const genConcrete = new THREE.Mesh(new THREE.BoxGeometry(3.5, 3.5, 3), concreteMat);
genConcrete.position.set(-6, 1.75, 0); genConcrete.castShadow = true; scene.add(genConcrete);

const genShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 6), metalMat);
genShaft.rotation.z = Math.PI / 2; genShaft.position.x = -1.5; genGroup.add(genShaft);
const pulley2 = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.4, 32), darkMetalMat);
pulley2.rotation.z = Math.PI / 2; pulley2.position.x = -4.5; genGroup.add(pulley2);
scene.add(genGroup);

const belt = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 0.8, 1, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 }));
belt.rotation.z = Math.PI / 2; belt.position.set(-11, 4.5, 0); belt.castShadow = true;
scene.add(belt);

// --- BOX PANEL ESP32 (CONTROL ROOM) + SOLAR PANEL ON TOP ---
const panelGroup = new THREE.Group();
panelGroup.position.set(-1, 2.5, 7); // Dinaikkan sedikit untuk kaki

// Kaki Panel
const legGeo = new THREE.CylinderGeometry(0.15, 0.15, 2.5);
for(let pos of [[-1.5, -1.25, 0.8], [1.5, -1.25, 0.8], [-1.5, -1.25, -0.8], [1.5, -1.25, -0.8]]) {
    const leg = new THREE.Mesh(legGeo, darkMetalMat);
    leg.position.set(...pos); leg.castShadow = true; panelGroup.add(leg);
}

// Body Panel Industri Proporsional
const panelBox = new THREE.Mesh(new THREE.BoxGeometry(3.5, 4.5, 2), new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.6, metalness: 0.4 }));
panelBox.position.y = 2.25; panelBox.castShadow = true;
panelGroup.add(panelBox);

// Pintu Kaca & Layar & Tombol
const glass = new THREE.Mesh(new THREE.PlaneGeometry(3, 4), new THREE.MeshStandardMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.4, roughness: 0.1, metalness: 0.8 }));
glass.position.set(0, 2.25, 1.01); panelGroup.add(glass);

const esp = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 0.2), new THREE.MeshStandardMaterial({ color: 0x111111 }));
esp.position.set(-0.5, 2.8, 0.5); panelGroup.add(esp);
const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.3), new THREE.MeshBasicMaterial({ color: 0x4ade80 }));
lcd.position.set(-0.5, 3.2, 0.61); panelGroup.add(lcd);
const emergencyBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1), new THREE.MeshStandardMaterial({ color: 0xdc2626 }));
emergencyBtn.rotation.x = Math.PI/2; emergencyBtn.position.set(1, 2, 1.05); panelGroup.add(emergencyBtn);

// SOLAR PANEL (DI ATAS KOTAK PANEL)
const solarGroup = new THREE.Group();
solarGroup.position.set(0, 5, 0); // Di atas Box (4.5 height)

const solarPlate = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.15, 3), new THREE.MeshStandardMaterial({ color: 0x1e3a8a, metalness: 0.8, roughness: 0.2 }));
solarPlate.rotation.x = Math.PI / 8; // Miring ke arah datangnya cahaya
solarPlate.castShadow = true;

// Grid texture representation via GridHelper disesuaikan skalanya
const gridHelper = new THREE.GridHelper(4.5, 9, 0xffffff, 0xffffff);
gridHelper.position.set(0, 0.08, 0);
gridHelper.rotation.x = Math.PI / 8;
gridHelper.scale.set(1, 1, 3/4.5); // Skala sumbu Z agar pas dengan plat
solarGroup.add(solarPlate, gridHelper);

// Bracket (Braket Penyangga)
const mount1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), darkMetalMat); mount1.position.set(-1.5, -0.3, 0);
const mount2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), darkMetalMat); mount2.position.set(1.5, -0.3, 0);
solarGroup.add(mount1, mount2);

panelGroup.add(solarGroup);
scene.add(panelGroup);

// --- RUMAH WARGA (BEBAN UTAMA) ---
const houseGroup = new THREE.Group();
houseGroup.position.set(15, 0, -5);
const hBody = new THREE.Mesh(new THREE.BoxGeometry(6, 5, 7), new THREE.MeshStandardMaterial({ color: 0xfef3c7 }));
hBody.position.y = 2.5; hBody.castShadow = true; hBody.receiveShadow = true;
const hRoof = new THREE.Mesh(new THREE.ConeGeometry(5.5, 4, 4), new THREE.MeshStandardMaterial({ color: 0xb91c1c }));
hRoof.position.y = 7; hRoof.rotation.y = Math.PI / 4; hRoof.castShadow = true;
houseGroup.add(hBody, hRoof);

const door = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 3), woodMat);
door.position.set(-3.01, 1.5, 0); door.rotation.y = -Math.PI / 2; houseGroup.add(door);

const windowMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 1 });
const hWindow = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), windowMat);
hWindow.position.set(-3.01, 2.5, 2); hWindow.rotation.y = -Math.PI / 2; houseGroup.add(hWindow);
const windowLight = new THREE.PointLight(0xfef08a, 1, 20);
windowLight.position.set(-4, 2.5, 2); houseGroup.add(windowLight);
scene.add(houseGroup);

// --- DUMMY LOAD (PEMANAS / HEATSINK) ---
const dummyGroup = new THREE.Group();
dummyGroup.position.set(12, 0, 8);
const dBase = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 4), darkMetalMat);
dBase.position.y = 0.25; dBase.castShadow = true; dummyGroup.add(dBase);

const coilMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff3a00, emissiveIntensity: 0 });
for(let i=0; i<3; i++) {
    const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 3, 16), coilMat);
    coil.position.set(-1 + i*1, 2, 0); coil.castShadow = true; dummyGroup.add(coil);
}
const dummyLight = new THREE.PointLight(0xff3a00, 0, 15);
dummyLight.position.set(0, 2, 0); dummyGroup.add(dummyLight);
scene.add(dummyGroup);

// --- KABEL MELENGKUNG (THICK WIRES) ---
function createThickWire(p1, p2, droop, color) {
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    mid.y -= droop;
    const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
    const geo = new THREE.TubeGeometry(curve, 20, 0.08, 8, false);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: color, roughness: 0.7 }));
    mesh.castShadow = true; scene.add(mesh);
}

// Generator -> Panel ESP (Kabel tebal masuk dari samping kotak)
createThickWire(new THREE.Vector3(-6, 3, 0), new THREE.Vector3(-2.8, 3.5, 7), 2, 0xef4444);
createThickWire(new THREE.Vector3(-6, 3.2, 0), new THREE.Vector3(-2.8, 3.7, 7), 2, 0x3b82f6);

// Panel ESP -> Rumah (Kabel beban utama keluar dari sisi kanan)
createThickWire(new THREE.Vector3(0.8, 3.5, 7), new THREE.Vector3(12, 4, -1.5), 3, 0x111111);

// Panel ESP -> Dummy Load (Orange tebal)
createThickWire(new THREE.Vector3(0.8, 3, 7), new THREE.Vector3(10, 0.5, 8), 1.5, 0xf97316);

// Note: Kabel Panel Surya -> ESP tidak perlu digambar menjuntai karena nempel langsung di box.

// --- RESIZE HANDLER ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function simulateStep() {
    const turbineTorque = getTurbineTorque();
    const generatorLoad = (mainLoadValue + dummyLoadPWM) * (rpm / SETPOINT_RPM);
    const friction = FRICTION_COEFFICIENT * rpm;
    const netTorque = turbineTorque - generatorLoad - friction;

    rpm = Math.max(0, rpm + (netTorque / INERTIA) * DT);
    voltage = rpm * VOLT_MULT;

    const error = voltage - SETPOINT;
    const excessLoad = turbineTorque - mainLoadValue - FRICTION_COEFFICIENT * SETPOINT_RPM;
    const speedCorrection = (rpm - SETPOINT_RPM) * ELC_SPEED_CORRECTION;
    const targetDummyLoad = Math.min(100, Math.max(0, excessLoad + speedCorrection));
    const maxLoadChange = ELC_SLEW_RATE * DT;
    const loadDifference = targetDummyLoad - dummyLoadPWM;
    dummyLoadPWM += Math.min(maxLoadChange, Math.max(-maxLoadChange, loadDifference));

    sliderELC.value = dummyLoadPWM.toFixed(1);
    document.getElementById('valELC').innerText = dummyLoadPWM.toFixed(1) + '%';

    if (error > 0.05 && dummyLoadPWM >= 99.5) {
        dStatus.innerText = 'BATAS DUMMY LOAD';
        dStatus.style.color = '#f87171';
    } else if (error < -0.05 && dummyLoadPWM <= 0.5 && turbineTorque < mainLoadValue + FRICTION_COEFFICIENT * SETPOINT_RPM) {
        dStatus.innerText = 'DEBIT KURANG';
        dStatus.style.color = '#f87171';
    } else if (error > 0.05 && dummyLoadPWM > 0.5) {
        dStatus.innerText = 'MENAMBAH BEBAN';
        dStatus.style.color = '#fbbf24';
    } else if (error < -0.05) {
        dStatus.innerText = 'MELEPAS BEBAN';
        dStatus.style.color = '#60a5fa';
    } else {
        dStatus.innerText = 'STABIL';
        dStatus.style.color = '#4ade80';
    }

    dRPM.innerText = rpm.toFixed(1);
    dVolt.innerText = voltage.toFixed(2);
    dDummy.innerText = dummyLoadPWM.toFixed(1);

    if (voltage > 13.5 || voltage < 10.5) dVolt.className = 'stat red';
    else if (voltage > 12.5 || voltage < 11.5) dVolt.className = 'stat yellow';
    else dVolt.className = 'stat green';
}

// --- ANIMATION LOOP ---
let previousFrameTime = 0;
let simulationAccumulator = 0;
function animate(frameTime) {
    requestAnimationFrame(animate);

    if (previousFrameTime === 0) previousFrameTime = frameTime;
    const elapsed = Math.min((frameTime - previousFrameTime) / 1000, 0.25);
    previousFrameTime = frameTime;
    simulationAccumulator += elapsed;

    while (simulationAccumulator >= DT) {
        simulateStep();
        simulationAccumulator -= DT;
    }

    const rotationDelta = (rpm * Math.PI * 2 / 60) * elapsed;
    wheelGroup.rotation.x -= rotationDelta;
    genBody.rotation.x -= rotationDelta * 2;
    waterTex.offset.y -= waterFlow * 0.0002 * (elapsed * 60);

    if (isMainLoadOn && voltage > 8) {
        const flicker = voltage < 11 ? Math.random() * 0.5 + 0.5 : 1;
        windowMat.emissiveIntensity = flicker;
        windowLight.intensity = flicker * 1.5;
    } else {
        windowMat.emissiveIntensity = 0;
        windowLight.intensity = 0;
    }

    const glow = dummyLoadPWM / 100;
    coilMat.emissiveIntensity = glow * 4;
    dummyLight.intensity = glow * 3;

    controls.update();
    renderer.render(scene, camera);
}

requestAnimationFrame(animate);