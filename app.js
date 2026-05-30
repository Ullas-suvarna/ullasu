// DairyPulse Cooperative Milk Collection System - State & UI Controller

// ==========================================
// 1. Firebase Config & State
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyDZPk-lQLN_bPd0BO_Z5OaPLFQfpCf-W8A",
  authDomain: "dairy-management-e8839.firebaseapp.com",
  projectId: "dairy-management-e8839",
  storageBucket: "dairy-management-e8839.firebasestorage.app",
  messagingSenderId: "642415403675",
  appId: "1:642415403675:web:ba06815d31027b20d91c3e"
};

let db = null;
let isFirebaseEnabled = false;

const state = {
    theme: localStorage.getItem('theme') || 'dark',
    activeRole: 'admin', // 'admin' or 'farmer'
    activeView: 'admin-dashboard', // Active section within the active role
    selectedFarmerId: 'F-101', // Farmer ID currently shown on the Farmer Portal

    // Cooperative Members Registry (Initial Mock State)
    farmers: [
        { id: 'F-101', name: 'John Doe', phone: '+91 98765 43210', bank: 'SBI-9023410293' },
        { id: 'F-102', name: 'Suresh Patel', phone: '+91 94281 90214', bank: 'BOB-8832049182' },
        { id: 'F-103', name: 'Anil Mehta', phone: '+91 99042 18274', bank: 'HDFC-1092834012' },
        { id: 'F-104', name: 'Sunita Sharma', phone: '+91 97250 83921', bank: 'PNB-7748392019' }
    ],

    // Daily Milk Collections Log (Initial Mock State)
    collections: [
        { id: 'DP-COL-1001', farmerId: 'F-101', farmerName: 'John Doe', shift: 'Morning', volume: 15.4, fat: 4.2, snf: 8.8, rate: 0.515, amount: 7.93, timestamp: '2026-05-30 08:30 AM', date: '2026-05-30' },
        { id: 'DP-COL-1002', farmerId: 'F-102', farmerName: 'Suresh Patel', shift: 'Morning', volume: 24.0, fat: 3.8, snf: 8.4, rate: 0.415, amount: 9.96, timestamp: '2026-05-30 08:45 AM', date: '2026-05-30' },
        { id: 'DP-COL-1003', farmerId: 'F-103', farmerName: 'Anil Mehta', shift: 'Morning', volume: 18.5, fat: 4.5, snf: 9.0, rate: 0.575, amount: 10.64, timestamp: '2026-05-30 09:12 AM', date: '2026-05-30' },
        { id: 'DP-COL-1004', farmerId: 'F-101', farmerName: 'John Doe', shift: 'Evening', volume: 12.0, fat: 4.1, snf: 8.7, rate: 0.490, amount: 5.88, timestamp: '2026-05-29 06:10 PM', date: '2026-05-29' },
        { id: 'DP-COL-1005', farmerId: 'F-104', farmerName: 'Sunita Sharma', shift: 'Evening', volume: 20.2, fat: 3.9, snf: 8.6, rate: 0.455, amount: 9.19, timestamp: '2026-05-29 06:40 PM', date: '2026-05-29' }
    ],

    // Simulated SMS gateway history log
    smsLogs: []
};

// ==========================================
// 2. Initialization & Hookups
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initClock();
    initRoleSwitcher();
    initNavigation();
    initFormCalculators();
    initModalControllers();
    registerFormHandlers();
    
    // Initialize Firebase
    initFirebase();
    
    // Set initial displays (updated by Firebase snapshots if online)
    populateFarmerSelects();
    renderCoopKPIs();
    renderTodayCollectionsTable();
    renderFarmersTable();
    renderFarmerLedgerTable();
    renderQualityChart();
    renderEarningsChart();
});

// Firebase Setup
function initFirebase() {
    const dbStatusEl = document.getElementById('dbStatus');
    const dbDotEl = document.getElementById('dbStatusDot');
    
    if (typeof firebase !== 'undefined') {
        try {
            firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
            isFirebaseEnabled = true;
            
            if (dbStatusEl && dbDotEl) {
                dbStatusEl.textContent = 'Live Sync';
                dbDotEl.className = 'status-dot connected';
            }
            console.log("Firebase initialized successfully.");
            
            setupFirestoreSync();
        } catch (error) {
            console.error("Firebase startup error:", error);
            if (dbStatusEl && dbDotEl) {
                dbStatusEl.textContent = 'Auth Error';
                dbDotEl.className = 'status-dot error';
            }
        }
    } else {
        console.warn("Firebase SDK script failed to load. Running in offline/mock mode.");
        if (dbStatusEl && dbDotEl) {
            dbStatusEl.textContent = 'Local Cache';
            dbDotEl.className = 'status-dot warning';
        }
    }
}

// Firestore Synchronizer
function setupFirestoreSync() {
    if (!db) return;

    // A. Sync Farmers Collection
    db.collection('farmers').onSnapshot(snapshot => {
        if (snapshot.empty) {
            console.log("Seeding Firestore with default cooperative members registry...");
            state.farmers.forEach(farmer => {
                db.collection('farmers').doc(farmer.id).set(farmer);
            });
        } else {
            const tempFarmers = [];
            snapshot.forEach(doc => {
                tempFarmers.push(doc.data());
            });
            state.farmers = tempFarmers;
            populateFarmerSelects();
            renderFarmersTable();
            renderTodayCollectionsTable(); // refresh naming caches if any
        }
    }, err => console.error("Farmers sync error:", err));

    // B. Sync Collections Collection
    db.collection('collections').onSnapshot(snapshot => {
        if (snapshot.empty) {
            console.log("Seeding Firestore with default milk collection log records...");
            state.collections.forEach(col => {
                db.collection('collections').doc(col.id).set(col);
            });
        } else {
            const tempCollections = [];
            snapshot.forEach(doc => {
                tempCollections.push(doc.data());
            });
            // Sort by chronological timestamp (latest first)
            tempCollections.sort((a,b) => b.timestamp.localeCompare(a.timestamp));
            state.collections = tempCollections;
            
            renderCoopKPIs();
            renderTodayCollectionsTable();
            renderFarmersTable(); // Updates volumes supplied
            renderFarmerLedgerTable();
            renderQualityChart();
            renderEarningsChart();
        }
    }, err => console.error("Collections sync error:", err));
}

// ==========================================
// 3. UI Navigation & Shift Controls
// ==========================================
function initTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            state.theme = state.theme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', state.theme);
            localStorage.setItem('theme', state.theme);
            showToast(`Theme switched to ${state.theme} mode`);
        });
    }
}

function initClock() {
    const timeEl = document.getElementById('currentTime');
    const dateEl = document.getElementById('currentDate');
    const shiftEl = document.getElementById('currentShift');
    const shiftDotEl = document.getElementById('shiftIndicatorDot');
    const colShiftEl = document.getElementById('colShift');
    
    function updateClock() {
        const now = new Date();
        timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        const options = { weekday: 'long', month: 'short', day: 'numeric' };
        dateEl.textContent = now.toLocaleDateString('en-US', options);
        
        // Dynamic shift determination
        // Morning shift: 5:00 AM - 12:00 PM. Evening shift: 12:00 PM - 9:00 PM.
        const hour = now.getHours();
        let shift = 'Evening';
        if (hour >= 5 && hour < 12) {
            shift = 'Morning';
        }
        
        if (shiftEl) shiftEl.textContent = `${shift} Shift`;
        if (shiftDotEl) {
            shiftDotEl.className = shift === 'Morning' ? 'status-dot healthy' : 'status-dot warning';
        }
        // Sync collection form shift dropdown on load
        if (colShiftEl && !colShiftEl.getAttribute('data-dirty')) {
            colShiftEl.value = shift;
        }
    }
    
    updateClock();
    setInterval(updateClock, 1000);
    
    if (colShiftEl) {
        colShiftEl.addEventListener('change', () => {
            colShiftEl.setAttribute('data-dirty', 'true');
        });
    }
}

// Portal Role Switcher
function initRoleSwitcher() {
    const adminBtn = document.getElementById('roleAdminBtn');
    const farmerBtn = document.getElementById('roleFarmerBtn');
    
    const adminItems = document.getElementById('adminNavItems');
    const farmerItems = document.getElementById('farmerNavItems');
    
    const adminContainer = document.getElementById('adminViewContainer');
    const farmerContainer = document.getElementById('farmerViewContainer');
    
    const navTitle = document.getElementById('navRoleTitle');
    const subTitle = document.getElementById('portalHeaderSubtitle');
    
    const profileName = document.getElementById('userProfileName');
    const profileRole = document.getElementById('userProfileRole');

    function toggleRole(role) {
        state.activeRole = role;
        
        // UI tabs active statuses
        if (role === 'admin') {
            adminBtn.classList.add('active');
            farmerBtn.classList.remove('active');
            
            adminItems.classList.remove('hidden');
            farmerItems.classList.add('hidden');
            
            adminContainer.classList.remove('hidden');
            farmerContainer.classList.add('hidden');
            
            navTitle.textContent = 'Admin Control';
            subTitle.textContent = 'Cooperative Collection Desk';
            
            profileName.textContent = 'Coop Admin';
            profileRole.textContent = 'Operator Desk';
            
            // Activate first admin view
            switchView('admin-dashboard');
        } else {
            adminBtn.classList.add('active'); // Wait
            adminBtn.classList.remove('active');
            farmerBtn.classList.add('active');
            
            adminItems.classList.add('hidden');
            farmerItems.classList.remove('hidden');
            
            adminContainer.classList.add('hidden');
            farmerContainer.classList.remove('hidden');
            
            navTitle.textContent = 'Farmer Control';
            subTitle.textContent = 'Member Self-Service Portal';
            
            profileName.textContent = 'Farmer Portal';
            profileRole.textContent = 'Member Registry';
            
            // Activate first farmer view
            switchView('farmer-dashboard');
            
            // Refresh charts for current selected farmer
            renderQualityChart();
            renderEarningsChart();
        }
    }

    if (adminBtn) adminBtn.addEventListener('click', () => toggleRole('admin'));
    if (farmerBtn) farmerBtn.addEventListener('click', () => toggleRole('farmer'));
    
    // Farmer Portal profile selector
    const portalSelect = document.getElementById('farmerPortalSelect');
    if (portalSelect) {
        portalSelect.addEventListener('change', (e) => {
            state.selectedFarmerId = e.target.value;
            renderFarmerPortalStats();
        });
    }
}

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const target = item.getAttribute('data-target');
            switchView(target);
        });
    });
}

function switchView(viewId) {
    const sections = document.querySelectorAll('.view-section');
    const navItems = document.querySelectorAll('.nav-item');
    const pageTitle = document.getElementById('pageTitle');
    
    sections.forEach(s => s.classList.remove('active-view'));
    navItems.forEach(n => n.classList.remove('active'));
    
    const targetSection = document.getElementById(`${viewId}View`);
    if (targetSection) targetSection.classList.add('active-view');
    
    const activeNav = Array.from(navItems).find(n => n.getAttribute('data-target') === viewId);
    if (activeNav) activeNav.classList.add('active');
    
    state.activeView = viewId;
    
    // Headers Formatting
    const viewTitles = {
        'admin-dashboard': 'Collection Desk',
        'admin-farmers': 'Member Registry',
        'farmer-dashboard': 'My Analytics Dashboard',
        'farmer-ledger': 'Receipt Archive'
    };
    pageTitle.textContent = viewTitles[viewId] || 'Cooperative Desk';
    
    if (viewId === 'farmer-dashboard') {
        renderFarmerPortalStats();
    }
}

// Populate Farmer selection dropdown list
function populateFarmerSelects() {
    const colSelect = document.getElementById('colFarmerId');
    const portalSelect = document.getElementById('farmerPortalSelect');
    
    if (colSelect) {
        const selected = colSelect.value;
        colSelect.innerHTML = '<option value="" disabled selected>Choose a farmer...</option>';
        state.farmers.forEach(farmer => {
            colSelect.innerHTML += `<option value="${farmer.id}">${farmer.id} - ${farmer.name}</option>`;
        });
        if (selected) colSelect.value = selected;
    }
    
    if (portalSelect) {
        portalSelect.innerHTML = '';
        state.farmers.forEach(farmer => {
            portalSelect.innerHTML += `<option value="${farmer.id}">${farmer.id} - ${farmer.name}</option>`;
        });
        portalSelect.value = state.selectedFarmerId;
    }
}

// ==========================================
// 4. Quality Pricing Calculation Formulas
// ==========================================
// Standard Cooperative Pricing Math:
// Rate per L = Base ($0.45) + (Fat - 4.0) * 0.10 + (SNF - 8.5) * 0.15
// Clamped to a minimum of $0.30 per Liter to protect farmer margins.
function calculateMilkRate(fat, snf) {
    const basePrice = 0.45;
    const baseFat = 4.0;
    const baseSnf = 8.5;
    
    const fatPremium = 0.10; // $0.10 per 1.0% fat above 4.0%
    const snfPremium = 0.15; // $0.15 per 1.0% snf above 8.5%
    
    const rate = basePrice + (fat - baseFat) * fatPremium + (snf - baseSnf) * snfPremium;
    return Math.max(0.30, parseFloat(rate.toFixed(3)));
}

function initFormCalculators() {
    const fatInput = document.getElementById('colFat');
    const snfInput = document.getElementById('colSnf');
    const volInput = document.getElementById('colVolume');
    
    function runLiveCalculation() {
        const fat = parseFloat(fatInput.value) || 4.0;
        const snf = parseFloat(snfInput.value) || 8.5;
        const vol = parseFloat(volInput.value) || 0;
        
        const rate = calculateMilkRate(fat, snf);
        const total = rate * vol;
        
        document.getElementById('liveRateVal').textContent = `$${rate.toFixed(3)}/L`;
        document.getElementById('liveTotalVal').textContent = `$${total.toFixed(2)}`;
    }
    
    if (fatInput) fatInput.addEventListener('input', runLiveCalculation);
    if (snfInput) snfInput.addEventListener('input', runLiveCalculation);
    if (volInput) volInput.addEventListener('input', runLiveCalculation);
}

// ==========================================
// 5. Cooperative Dashboard Metrics (Admin view)
// ==========================================
function renderCoopKPIs() {
    // Metric 1: Volume collected today
    const todayStr = new Date().toISOString().split('T')[0];
    const todayCollections = state.collections.filter(c => c.date === todayStr);
    
    const totalVolume = todayCollections.reduce((sum, c) => sum + c.volume, 0);
    const avgFat = todayCollections.length > 0 ? (todayCollections.reduce((sum, c) => sum + c.fat, 0) / todayCollections.length) : 0;
    const avgSnf = todayCollections.length > 0 ? (todayCollections.reduce((sum, c) => sum + c.snf, 0) / todayCollections.length) : 0;
    const totalPayout = todayCollections.reduce((sum, c) => sum + c.amount, 0);
    
    const volEl = document.getElementById('kpiCoopVolume');
    const countEl = document.getElementById('kpiCoopVolumeCount');
    const fatEl = document.getElementById('kpiCoopFat');
    const snfEl = document.getElementById('kpiCoopSnf');
    const payoutEl = document.getElementById('kpiCoopPayout');
    
    if (volEl) volEl.textContent = `${totalVolume.toFixed(1)} L`;
    if (countEl) countEl.textContent = `${todayCollections.length} collection entries today`;
    if (fatEl) fatEl.textContent = `${avgFat.toFixed(2)}%`;
    if (snfEl) snfEl.textContent = `${avgSnf.toFixed(2)}%`;
    if (payoutEl) payoutEl.textContent = `$${totalPayout.toFixed(2)}`;
}

function renderTodayCollectionsTable() {
    const tbody = document.getElementById('todayCollectionsTableBody');
    if (!tbody) return;
    
    const todayStr = new Date().toISOString().split('T')[0];
    const todayCollections = state.collections.filter(c => c.date === todayStr);
    
    tbody.innerHTML = '';
    
    if (todayCollections.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No milk records entered today.</td></tr>`;
        return;
    }
    
    todayCollections.forEach(col => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <strong>${col.farmerName}</strong><br>
                <span class="text-muted" style="font-size:11px;">Tag: ${col.farmerId}</span>
            </td>
            <td><strong>${col.shift}</strong></td>
            <td>
                <span>Qty: <strong>${col.volume} L</strong></span><br>
                <span class="text-muted" style="font-size:11px;">Fat: ${col.fat}% | SNF: ${col.snf}%</span>
            </td>
            <td>
                <strong>$${col.amount.toFixed(2)}</strong><br>
                <span class="text-muted" style="font-size:11px;">Rate: $${col.rate.toFixed(3)}/L</span>
            </td>
            <td>
                <button class="btn btn-outline btn-sm" onclick="showReceiptSlip('${col.id}')">View Slip</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderFarmersTable() {
    const tbody = document.getElementById('farmersTableBody');
    if (!tbody) return;
    
    const searchQuery = document.getElementById('farmerSearchInput')?.value.toLowerCase() || '';
    
    tbody.innerHTML = '';
    
    const filteredFarmers = state.farmers.filter(f => {
        return f.id.toLowerCase().includes(searchQuery) || 
               f.name.toLowerCase().includes(searchQuery) || 
               f.phone.includes(searchQuery);
    });
    
    if (filteredFarmers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">No members registered under current filters.</td></tr>`;
        return;
    }
    
    filteredFarmers.forEach(farmer => {
        // Calculate cumulative totals supplied
        const farmerCols = state.collections.filter(c => c.farmerId === farmer.id);
        const totalVol = farmerCols.reduce((sum, c) => sum + c.volume, 0);
        const totalEarnings = farmerCols.reduce((sum, c) => sum + c.amount, 0);
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="mono">${farmer.id}</span></td>
            <td><strong>${farmer.name}</strong></td>
            <td><span>${farmer.phone}</span></td>
            <td><strong>${totalVol.toFixed(1)} L</strong></td>
            <td><strong class="text-accent">$${totalEarnings.toFixed(2)}</strong></td>
            <td>
                <button class="btn btn-text btn-sm text-primary" onclick="viewFarmerOnPortal('${farmer.id}')">Portal view</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Global actions exposed
window.viewFarmerOnPortal = function(farmerId) {
    state.selectedFarmerId = farmerId;
    const select = document.getElementById('farmerPortalSelect');
    if (select) select.value = farmerId;
    
    // Toggle role to farmer
    const roleBtn = document.getElementById('roleFarmerBtn');
    if (roleBtn) roleBtn.click();
};

// ==========================================
// 6. Farmer Portal Stats & Subscriptions Views
// ==========================================
function renderFarmerPortalStats() {
    const farmer = state.farmers.find(f => f.id === state.selectedFarmerId);
    if (!farmer) return;
    
    // Filter farmer collections
    const farmerCols = state.collections.filter(c => c.farmerId === farmer.id);
    
    const totalVol = farmerCols.reduce((sum, c) => sum + c.volume, 0);
    const avgFat = farmerCols.length > 0 ? (farmerCols.reduce((sum, c) => sum + c.fat, 0) / farmerCols.length) : 0;
    const avgSnf = farmerCols.length > 0 ? (farmerCols.reduce((sum, c) => sum + c.snf, 0) / farmerCols.length) : 0;
    const totalEarnings = farmerCols.reduce((sum, c) => sum + c.amount, 0);
    
    document.getElementById('kpiFarmerVolume').textContent = `${totalVol.toFixed(1)} L`;
    document.getElementById('kpiFarmerCollectionsCount').textContent = `${farmerCols.length} milk deliveries logged`;
    document.getElementById('kpiFarmerFat').textContent = `${avgFat.toFixed(2)}%`;
    document.getElementById('kpiFarmerSnf').textContent = `Avg SNF: ${avgSnf.toFixed(2)}%`;
    document.getElementById('kpiFarmerEarnings').textContent = `$${totalEarnings.toFixed(2)}`;
    
    renderFarmerLedgerTable();
    renderQualityChart();
    renderEarningsChart();
}

function renderFarmerLedgerTable() {
    const tbody = document.getElementById('farmerLedgerTableBody');
    if (!tbody) return;
    
    const farmerCols = state.collections.filter(c => c.farmerId === state.selectedFarmerId);
    tbody.innerHTML = '';
    
    if (farmerCols.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">No delivery records logged for this farmer profile.</td></tr>`;
        return;
    }
    
    farmerCols.forEach(col => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span>${col.timestamp}</span></td>
            <td><strong>${col.shift}</strong></td>
            <td><strong>${col.volume} L</strong></td>
            <td><span>Fat: ${col.fat}% | SNF: ${col.snf}%</span></td>
            <td><span>$${col.rate.toFixed(3)}/L</span></td>
            <td><strong class="text-accent">$${col.amount.toFixed(2)}</strong></td>
            <td>
                <button class="btn btn-outline btn-sm" onclick="showReceiptSlip('${col.id}')">View Slip</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// 7. Dynamic Performance Charts (Farmer View)
// ==========================================
function renderQualityChart() {
    const wrapper = document.getElementById('farmerQualityChartWrapper');
    if (!wrapper) return;
    
    wrapper.innerHTML = '';
    const width = wrapper.clientWidth;
    const height = 180;
    
    const paddingLeft = 40;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;
    
    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;
    
    // Get farmer submissions (sorted earliest to latest for chart display)
    const farmerCols = state.collections
        .filter(c => c.farmerId === state.selectedFarmerId)
        .reverse(); // Reverse back to chronological order (past to present)
        
    if (farmerCols.length === 0) {
        wrapper.innerHTML = `<div style="color:var(--text-muted); font-size:12px;">No historical metrics logged.</div>`;
        return;
    }
    
    // Min/max scopes: Fat between 2.0 and 8.0, SNF between 6.0 and 12.0
    const minVal = 2.0;
    const maxVal = 10.0;
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', height);
    svg.style.overflow = 'visible';
    
    // Draw horizontal grid references
    const count = 4;
    for (let i = 0; i <= count; i++) {
        const ratio = i / count;
        const y = height - paddingBottom - ratio * chartHeight;
        const val = minVal + ratio * (maxVal - minVal);
        
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', paddingLeft);
        line.setAttribute('y1', y);
        line.setAttribute('x2', width - paddingRight);
        line.setAttribute('y2', y);
        line.setAttribute('stroke', 'var(--bg-card-border)');
        svg.appendChild(line);
        
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', paddingLeft - 10);
        label.setAttribute('y', y + 4);
        label.setAttribute('text-anchor', 'end');
        label.setAttribute('fill', 'var(--text-muted)');
        label.setAttribute('font-size', '10');
        label.textContent = `${val.toFixed(1)}%`;
        svg.appendChild(label);
    }
    
    // Plot lines
    let fatPoints = [];
    let snfPoints = [];
    
    farmerCols.forEach((col, idx) => {
        const x = paddingLeft + (idx / Math.max(1, farmerCols.length - 1)) * chartWidth;
        const yFat = height - paddingBottom - ((col.fat - minVal) / (maxVal - minVal)) * chartHeight;
        const ySnf = height - paddingBottom - ((col.snf - minVal) / (maxVal - minVal)) * chartHeight;
        
        fatPoints.push({ x, y: yFat, val: col.fat });
        snfPoints.push({ x, y: ySnf, val: col.snf });
    });
    
    // SVG Paths renderer
    function generatePathString(pts) {
        if (pts.length === 0) return '';
        let d = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 1; i < pts.length; i++) {
            d += ` L ${pts[i].x} ${pts[i].y}`;
        }
        return d;
    }
    
    // Fat line (emerald)
    const fatPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    fatPath.setAttribute('d', generatePathString(fatPoints));
    fatPath.setAttribute('fill', 'none');
    fatPath.setAttribute('stroke', 'var(--primary)');
    fatPath.setAttribute('stroke-width', '2.5');
    svg.appendChild(fatPath);
    
    // SNF Line (cyan)
    const snfPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    snfPath.setAttribute('d', generatePathString(snfPoints));
    snfPath.setAttribute('fill', 'none');
    snfPath.setAttribute('stroke', 'var(--accent-info)');
    snfPath.setAttribute('stroke-width', '2.5');
    svg.appendChild(snfPath);
    
    // Add dots
    fatPoints.forEach((pt, idx) => {
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('cx', pt.x);
        c.setAttribute('cy', pt.y);
        c.setAttribute('r', '4');
        c.setAttribute('fill', 'var(--primary)');
        svg.appendChild(c);
        
        // Label x indexes
        if (idx % Math.ceil(farmerCols.length / 5) === 0 || idx === farmerCols.length - 1) {
            const xLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            xLabel.setAttribute('x', pt.x);
            xLabel.setAttribute('y', height - 10);
            xLabel.setAttribute('text-anchor', 'middle');
            xLabel.setAttribute('fill', 'var(--text-muted)');
            xLabel.setAttribute('font-size', '9');
            xLabel.textContent = `Slip #${idx+1}`;
            svg.appendChild(xLabel);
        }
    });
    
    snfPoints.forEach(pt => {
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('cx', pt.x);
        c.setAttribute('cy', pt.y);
        c.setAttribute('r', '4');
        c.setAttribute('fill', 'var(--accent-info)');
        svg.appendChild(c);
    });
    
    wrapper.appendChild(svg);
}

function renderEarningsChart() {
    const wrapper = document.getElementById('farmerEarningsChartWrapper');
    if (!wrapper) return;
    
    wrapper.innerHTML = '';
    const width = wrapper.clientWidth;
    const height = 180;
    
    const paddingLeft = 40;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;
    
    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;
    
    const farmerCols = state.collections
        .filter(c => c.farmerId === state.selectedFarmerId)
        .reverse();
        
    if (farmerCols.length === 0) {
        wrapper.innerHTML = `<div style="color:var(--text-muted); font-size:12px;">No historical earnings log.</div>`;
        return;
    }
    
    const minVal = 0;
    const maxVal = Math.max(15, Math.ceil(Math.max(...farmerCols.map(c => c.amount)) / 5) * 5);
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', height);
    svg.style.overflow = 'visible';
    
    // Draw horizontal grid lines
    const count = 4;
    for (let i = 0; i <= count; i++) {
        const ratio = i / count;
        const y = height - paddingBottom - ratio * chartHeight;
        const val = minVal + ratio * (maxVal - minVal);
        
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', paddingLeft);
        line.setAttribute('y1', y);
        line.setAttribute('x2', width - paddingRight);
        line.setAttribute('y2', y);
        line.setAttribute('stroke', 'var(--bg-card-border)');
        svg.appendChild(line);
        
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', paddingLeft - 10);
        label.setAttribute('y', y + 4);
        label.setAttribute('text-anchor', 'end');
        label.setAttribute('fill', 'var(--text-muted)');
        label.setAttribute('font-size', '10');
        label.textContent = `$${val.toFixed(0)}`;
        svg.appendChild(label);
    }
    
    // Plot bar graphs
    const barWidth = Math.max(5, (chartWidth / farmerCols.length) * 0.5);
    
    farmerCols.forEach((col, idx) => {
        const x = paddingLeft + (idx / Math.max(1, farmerCols.length - 1)) * chartWidth - barWidth/2;
        const y = height - paddingBottom - ((col.amount - minVal) / (maxVal - minVal)) * chartHeight;
        const barHeight = height - paddingBottom - y;
        
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', barWidth);
        rect.setAttribute('height', Math.max(2, barHeight));
        rect.setAttribute('fill', 'var(--accent-warning)');
        rect.setAttribute('rx', '2');
        svg.appendChild(rect);
        
        if (idx % Math.ceil(farmerCols.length / 5) === 0 || idx === farmerCols.length - 1) {
            const xLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            xLabel.setAttribute('x', x + barWidth/2);
            xLabel.setAttribute('y', height - 10);
            xLabel.setAttribute('text-anchor', 'middle');
            xLabel.setAttribute('fill', 'var(--text-muted)');
            xLabel.setAttribute('font-size', '9');
            xLabel.textContent = `Slip #${idx+1}`;
            svg.appendChild(xLabel);
        }
    });
    
    wrapper.appendChild(svg);
}

// ==========================================
// 8. Receipt Generator System (Digital Slip)
// ==========================================
window.showReceiptSlip = function(collectionId) {
    const col = state.collections.find(c => c.id === collectionId);
    if (!col) return;
    
    document.getElementById('recReceiptId').textContent = col.id;
    document.getElementById('recTimestamp').textContent = col.timestamp;
    document.getElementById('recShift').textContent = col.shift;
    document.getElementById('recFarmerId').textContent = col.farmerId;
    document.getElementById('recFarmerName').textContent = col.farmerName;
    document.getElementById('recVolume').textContent = `${col.volume} L`;
    document.getElementById('recFat').textContent = `${col.fat.toFixed(2)}%`;
    document.getElementById('recSnf').textContent = `${col.snf.toFixed(2)}%`;
    document.getElementById('recRate').textContent = `$${col.rate.toFixed(3)}/L`;
    document.getElementById('recTotalAmount').textContent = `$${col.amount.toFixed(2)}`;
    
    document.getElementById('receiptModal').classList.add('active');
};

// ==========================================
// 9. SMS gateway simulator log dispatcher
// ==========================================
function dispatchSimulatedSMS(farmerName, phone, volume, fat, snf, total) {
    const logsContainer = document.getElementById('smsGatewayLogs');
    if (!logsContainer) return;
    
    // Clear empty prompt log first
    const emptyLog = logsContainer.querySelector('.sms-log-empty');
    if (emptyLog) emptyLog.remove();
    
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const bubble = document.createElement('div');
    bubble.className = 'sms-bubble';
    bubble.innerHTML = `
        <div style="font-weight:700; color:var(--text-main); margin-bottom:4px; font-size:10px;">
            ALERT DISPATCHED &raquo; To: ${phone} (${timeStr})
        </div>
        Dear ${farmerName}, received ${volume}L milk. Fat: ${fat}%, SNF: ${snf}%. Session Earnings: $${total.toFixed(2)}. Direct deposit initiated.
    `;
    
    logsContainer.insertBefore(bubble, logsContainer.firstChild);
    
    // Limit to latest 10 logs
    const bubbles = logsContainer.querySelectorAll('.sms-bubble');
    if (bubbles.length > 10) {
        bubbles[bubbles.length - 1].remove();
    }
}

// ==========================================
// 10. Modals Controllers & Form Submissions
// ==========================================
function initModalControllers() {
    // Add Farmer Modals
    const openAddFarmerBtn = document.getElementById('openAddFarmerModalBtn');
    const closeAddFarmerBtn = document.getElementById('closeAddFarmerModalBtn');
    const cancelAddFarmerBtn = document.getElementById('cancelAddFarmerBtn');
    const addFarmerModal = document.getElementById('addFarmerModal');
    
    if (openAddFarmerBtn) openAddFarmerBtn.addEventListener('click', () => addFarmerModal.classList.add('active'));
    if (closeAddFarmerBtn) closeAddFarmerBtn.addEventListener('click', () => addFarmerModal.classList.remove('active'));
    if (cancelAddFarmerBtn) cancelAddFarmerBtn.addEventListener('click', () => addFarmerModal.classList.remove('active'));
    
    // Receipt Modal Close controls
    const closeReceiptBtn = document.getElementById('closeReceiptModalBtn');
    const receiptModal = document.getElementById('receiptModal');
    if (closeReceiptBtn) closeReceiptBtn.addEventListener('click', () => receiptModal.classList.remove('active'));
    
    // Click backdrop to dismiss
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-backdrop')) {
            e.target.classList.remove('active');
        }
    });
    
    // Printable receipt sheet handler
    const printBtn = document.getElementById('printReceiptBtn');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            window.print();
        });
    }
}

function registerFormHandlers() {
    // Form 1: New Member Registration
    const addFarmerForm = document.getElementById('addFarmerForm');
    if (addFarmerForm) {
        addFarmerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const id = document.getElementById('newFarmerId').value.toUpperCase().trim();
            const name = document.getElementById('newFarmerName').value.trim();
            const phone = document.getElementById('newFarmerPhone').value.trim();
            const bank = document.getElementById('newFarmerBank').value.trim();
            
            if (state.farmers.some(f => f.id === id)) {
                showToast(`Farmer ID Tag ${id} is already registered!`, 'error');
                return;
            }
            
            const newFarmer = { id, name, phone, bank };
            
            if (isFirebaseEnabled && db) {
                db.collection('farmers').doc(id).set(newFarmer)
                  .then(() => {
                      showToast(`Member F-${id} synchronized to cloud database`);
                  })
                  .catch(err => console.error("Error saving farmer:", err));
            } else {
                state.farmers.push(newFarmer);
                populateFarmerSelects();
                renderFarmersTable();
                showToast(`Member ${id} added successfully`);
            }
            
            document.getElementById('addFarmerModal').classList.remove('active');
            addFarmerForm.reset();
        });
    }
    
    // Form 2: Daily Shift Collection Form
    const collectionForm = document.getElementById('milkCollectionForm');
    if (collectionForm) {
        collectionForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const farmerId = document.getElementById('colFarmerId').value;
            const shift = document.getElementById('colShift').value;
            const volume = parseFloat(document.getElementById('colVolume').value);
            const fat = parseFloat(document.getElementById('colFat').value);
            const snf = parseFloat(document.getElementById('colSnf').value);
            
            const farmer = state.farmers.find(f => f.id === farmerId);
            if (!farmer) {
                showToast("Please choose a valid registered farmer profile.", "error");
                return;
            }
            
            // Calculate rates
            const rate = calculateMilkRate(fat, snf);
            const total = rate * volume;
            
            const now = new Date();
            // Format time nicely
            const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
            const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
            const timeStr = `${dateStr} ${now.toLocaleTimeString([], timeOptions)}`;
            
            const txId = `DP-COL-${Date.now().toString().slice(-6)}`;
            
            const newCollection = {
                id: txId,
                farmerId,
                farmerName: farmer.name,
                shift,
                volume,
                fat,
                snf,
                rate,
                amount: parseFloat(total.toFixed(2)),
                timestamp: timeStr,
                date: dateStr
            };
            
            // Trigger simulated SMS log right away
            dispatchSimulatedSMS(farmer.name, farmer.phone, volume, fat, snf, total);
            
            if (isFirebaseEnabled && db) {
                db.collection('collections').doc(txId).set(newCollection)
                  .then(() => {
                      showToast(`Collection receipt synced with Firebase`);
                      showReceiptSlip(txId); // open slip
                  })
                  .catch(err => {
                      console.error("Collection write error:", err);
                      showToast("Write permission blocked. Check Firestore rules.", "error");
                  });
            } else {
                state.collections.unshift(newCollection);
                renderCoopKPIs();
                renderTodayCollectionsTable();
                renderFarmersTable();
                showToast(`Milk receipt logged successfully (Offline)`);
                showReceiptSlip(txId);
            }
            
            // Reset input values but keep shift/farmer selections for rapid entries
            document.getElementById('colVolume').value = '';
            document.getElementById('colFat').value = '4.0';
            document.getElementById('colSnf').value = '8.5';
            
            // Reset calculation display triggers
            document.getElementById('liveRateVal').textContent = '$0.00/L';
            document.getElementById('liveTotalVal').textContent = '$0.00';
        });
    }
}

// Toast alerts utility
function showToast(message, type = 'success') {
    const toast = document.getElementById('toastNotification');
    const toastMsg = document.getElementById('toastMessage');
    
    if (!toast || !toastMsg) return;
    
    toastMsg.textContent = message;
    toast.style.borderColor = type === 'error' ? 'var(--accent-error)' : 'var(--primary)';
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Global active charts tooltip handles
let activeTooltip = null;
