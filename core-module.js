// ============================================
// Network Performance Core Module
// For authorized load testing only
// ============================================

(function(){
    // ========== CONFIG ==========
    const _cfg = {
        endpoint: null,
        method: 'GET',
        port: 80,
        workers: 100,
        duration: 60,
        interval: 1,
        active: false,
        startTime: 0,
        _stats: { total: 0, success: 0, error: 0 },
        _activeWorkers: 0,
        _rpsLog: []
    };
    
    // ========== DOM REFERENCES ==========
    const _dom = {
        endpoint: document.getElementById('endpointUrl'),
        method: document.getElementById('reqType'),
        port: document.getElementById('portNumber'),
        workers: document.getElementById('concurrencyLevel'),
        duration: document.getElementById('testDuration'),
        interval: document.getElementById('reqInterval'),
        runBtn: document.getElementById('runBtn'),
        stopBtn: document.getElementById('stopBtn'),
        resetBtn: document.getElementById('resetBtn'),
        total: document.getElementById('totalReqCount'),
        success: document.getElementById('successReqCount'),
        error: document.getElementById('errorReqCount'),
        rps: document.getElementById('reqPerSec'),
        workersCount: document.getElementById('activeWorkerCount'),
        timeLeft: document.getElementById('timeLeft'),
        console: document.getElementById('consoleLog')
    };
    
    // ========== UTILITIES ==========
    function _log(msg, type){
        const div = document.createElement('div');
        div.className = `log-line log-${type||'success'}`;
        div.innerHTML = `[${new Date().toLocaleTimeString()}] ${msg}`;
        _dom.console.appendChild(div);
        div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        while(_dom.console.children.length > 200) _dom.console.removeChild(_dom.console.firstChild);
    }
    
    function _updateUI(){
        _dom.total.innerText = _cfg._stats.total.toLocaleString();
        _dom.success.innerText = _cfg._stats.success.toLocaleString();
        _dom.error.innerText = _cfg._stats.error.toLocaleString();
        _dom.workersCount.innerText = _cfg._activeWorkers;
        const now = Date.now();
        _cfg._rpsLog = _cfg._rpsLog.filter(t => now - t < 1000);
        _dom.rps.innerText = _cfg._rpsLog.length;
        if(_cfg.active && _cfg.duration > 0){
            const elapsed = (now - _cfg.startTime) / 1000;
            _dom.timeLeft.innerText = Math.max(0, Math.ceil(_cfg.duration - elapsed));
        } else { _dom.timeLeft.innerText = 0; }
    }
    
    function _record(success){
        _cfg._stats.total++;
        _cfg._rpsLog.push(Date.now());
        if(success) _cfg._stats.success++;
        else _cfg._stats.error++;
        _updateUI();
    }
    
    // ========== CORE EXECUTOR ==========
    async function _execute(target, reqMethod){
        if(!_cfg.active) return false;
        try {
            const options = {
                method: reqMethod,
                mode: 'no-cors',
                cache: 'no-store',
                headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*' }
            };
            if(reqMethod === 'POST'){
                options.body = `ts=${Date.now()}&r=${Math.random()}`;
                options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            }
            await fetch(target, options);
            _record(true);
            return true;
        } catch(e){
            _record(false);
            return false;
        }
    }
    
    async function _workerLoop(id, target, reqMethod, delayMs){
        _cfg._activeWorkers++;
        _updateUI();
        while(_cfg.active){
            const start = Date.now();
            await _execute(target, reqMethod);
            const elapsed = Date.now() - start;
            let wait = delayMs;
            if(elapsed < 10 && delayMs > 0) wait = Math.max(0, delayMs - elapsed);
            if(wait > 0) await new Promise(r => setTimeout(r, wait));
        }
        _cfg._activeWorkers--;
        _updateUI();
    }
    
    // ========== MAIN CONTROLLER ==========
    async function _start(){
        if(_cfg.active){
            _log('Test already running. Stop current test first.', 'error');
            return;
        }
        let target = _dom.endpoint.value.trim();
        const port = parseInt(_dom.port.value) || 80;
        const workers = parseInt(_dom.workers.value) || 100;
        const duration = parseInt(_dom.duration.value) || 60;
        const delay = parseInt(_dom.interval.value) || 1;
        const reqMethod = _dom.method.value;
        
        if(!target){
            _log('Please enter a valid endpoint URL', 'error');
            return;
        }
        if(!target.startsWith('http')) target = 'http://' + target;
        if(port !== 80 && port !== 443){
            try {
                const u = new URL(target);
                u.port = port;
                target = u.toString();
            } catch(e){}
        }
        
        _log(`=== LOAD TEST INITIATED ===`, 'success');
        _log(`Target: ${target}`, 'success');
        _log(`Method: ${reqMethod} | Workers: ${workers} | Duration: ${duration}s`, 'success');
        
        _cfg.active = true;
        _cfg.startTime = Date.now();
        _cfg.duration = duration;
        _cfg._stats = { total: 0, success: 0, error: 0 };
        _cfg._rpsLog = [];
        
        for(let i=0; i<workers; i++){
            _workerLoop(i, target, reqMethod, delay);
            await new Promise(r => setTimeout(r, 5));
        }
        
        _log(`Deployed ${workers} test workers`, 'success');
        
        const timer = setInterval(() => {
            if(!_cfg.active){ clearInterval(timer); return; }
            const elapsed = (Date.now() - _cfg.startTime) / 1000;
            if(elapsed >= duration){
                clearInterval(timer);
                _stop();
                const rate = _cfg._stats.total > 0 ? ((_cfg._stats.success/_cfg._stats.total)*100).toFixed(1) : 0;
                _log(`=== TEST COMPLETED === Total: ${_cfg._stats.total} | Success Rate: ${rate}%`, 'success');
            }
            _updateUI();
        }, 200);
    }
    
    function _stop(){
        if(!_cfg.active){
            _log('No active test running', 'error');
            return;
        }
        _cfg.active = false;
        _log(`Test terminated. Total requests: ${_cfg._stats.total}`, 'error');
        _updateUI();
    }
    
    function _reset(){
        if(_cfg.active) _stop();
        _cfg._stats = { total: 0, success: 0, error: 0 };
        _cfg._rpsLog = [];
        _cfg._activeWorkers = 0;
        _updateUI();
        _log('Statistics reset', 'success');
    }
    
    // ========== BIND EVENTS ==========
    _dom.runBtn.addEventListener('click', _start);
    _dom.stopBtn.addEventListener('click', _stop);
    _dom.resetBtn.addEventListener('click', _reset);
    
    // Matrix background
    const canvas = document.getElementById('bgCanvas');
    const ctx = canvas.getContext('2d');
    function resizeCanvas(){ canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    const chars = "01アイウエオカキクケコ";
    const fontSize = 14;
    const cols = canvas.width / fontSize;
    let drops = [];
    for(let i=0; i<cols; i++) drops[i] = Math.random() * canvas.height / fontSize;
    function drawBg(){
        ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#00d4ff';
        ctx.font = fontSize + 'px monospace';
        for(let i=0; i<drops.length; i++){
            ctx.fillText(chars[Math.floor(Math.random()*chars.length)], i*fontSize, drops[i]*fontSize);
            if(drops[i]*fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
            drops[i]++;
        }
        requestAnimationFrame(drawBg);
    }
    drawBg();
    
    _log('[LAB] Core module loaded', 'success');
    _log('[LAB] Ready for load testing', 'success');
})();