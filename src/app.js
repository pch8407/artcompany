let state = {
    view: 'daily',
    employees: [],
    selectedDate: new Date().toISOString().split('T')[0],
    attendance: {},
    newEmployeeName: '',
    stats: [],
    monthlyRecords: [],
    selectedMonth: new Date().toISOString().slice(0, 7)
};

// Utility to format date in Korean
function formatKDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${y}년 ${m}월 ${d}일`;
}

function formatKMonth(monthStr) {
    const [y, m] = monthStr.split('-');
    return `${y}년 ${m}월`;
}

// API Calls
window.fetchEmployees = async function() {
    const res = await fetch('/api/employees');
    state.employees = await res.json();
    render();
}

window.fetchAttendance = async function(date) {
    const res = await fetch(`/api/attendance?date=${date}`);
    const data = await res.json();
    state.attendance = {};
    data.forEach(r => {
        state.attendance[r.employee_id] = r.value;
    });
    render();
}

window.fetchMonthlyData = async function(month) {
    const res = await fetch(`/api/attendance?month=${month}`);
    const data = await res.json();
    state.monthlyRecords = data;
    
    const summary = {};
    data.forEach(r => {
        if (!summary[r.employee_name]) {
            summary[r.employee_name] = { total: 0, days: 0 };
        }
        summary[r.employee_name].total += r.value;
        if (r.value > 0) {
            summary[r.employee_name].days += 1;
        }
    });

    state.stats = Object.entries(summary).map(([name, s]) => ({
        employee_name: name,
        total: s.total,
        days: s.days
    })).sort((a, b) => b.total - a.total);

    render();
}

window.handleAttendanceChange = async function(employeeId, value) {
    const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId, date: state.selectedDate, value })
    });
    if (res.ok) {
        state.attendance[employeeId] = value;
        render();
    }
}

window.handleAddEmployee = async function(name) {
    if (!name.trim()) return;
    const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });
    if (res.ok) {
        await window.fetchEmployees();
    } else {
        alert('이미 등록된 이름이거나 오류가 발생했습니다.');
    }
}

window.handleDeleteEmployee = async function(id, name) {
    try {
        const confirmed = window.confirm(`${name} 직원을 삭제하시겠습니까? 관련 기록이 모두 삭제됩니다.`);
        if (!confirmed) return;

        const res = await fetch(`/api/employees/${id}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            await window.fetchEmployees();
            // If we were on daily view, refresh attendance too
            if (state.view === 'daily') {
                await window.fetchAttendance(state.selectedDate);
            }
        } else {
            const errorData = await res.json().catch(() => ({}));
            alert('삭제 실패: ' + (errorData.error || '서버 오류가 발생했습니다.'));
        }
    } catch (error) {
        console.error('Delete error:', error);
        alert('오류 발생: ' + error.message);
    }
}

// Navigation & Date Controls
window.setView = function(view) {
    state.view = view;
    if (view === 'daily') window.fetchAttendance(state.selectedDate);
    if (view === 'stats' || view === 'calendar') window.fetchMonthlyData(state.selectedMonth);
    render();
}

window.changeDate = function(days) {
    const [year, month, day] = state.selectedDate.split('-').map(Number);
    const d = new Date(year, month - 1, day + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayStr = String(d.getDate()).padStart(2, '0');
    state.selectedDate = `${y}-${m}-${dayStr}`;
    window.fetchAttendance(state.selectedDate);
}

window.changeMonth = function(months) {
    const [year, month] = state.selectedMonth.split('-').map(Number);
    const d = new Date(year, month - 1 + months, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    state.selectedMonth = `${y}-${m}`;
    window.fetchMonthlyData(state.selectedMonth);
}

// Rendering
function render() {
    const app = document.getElementById('app');
    app.innerHTML = '';

    // Header/Content based on view
    const container = document.createElement('div');
    container.className = 'space-y-8';

    if (state.view === 'daily') {
        container.innerHTML = `
            <header class="flex items-center justify-between">
                <div>
                    <h1 class="text-3xl font-serif italic tracking-tight">Daily Record</h1>
                    <p class="text-xs uppercase tracking-widest opacity-50 font-bold mt-1">출퇴근 체크</p>
                </div>
                <div class="flex items-center gap-4 bg-white border border-[#141414]/10 rounded-full px-4 py-2">
                    <button data-action="change-date" data-value="-1" class="hover:text-emerald-600 transition-colors"><i data-lucide="chevron-left" class="pointer-events-none"></i></button>
                    <span class="font-mono text-sm font-bold">${formatKDate(state.selectedDate)}</span>
                    <button data-action="change-date" data-value="1" class="hover:text-emerald-600 transition-colors"><i data-lucide="chevron-right" class="pointer-events-none"></i></button>
                </div>
            </header>
            <div class="space-y-4">
                ${state.employees.map(emp => `
                    <div class="bg-white border border-[#141414]/10 rounded-2xl p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">${emp.name[0]}</div>
                            <div>
                                <h3 class="font-bold text-lg">${emp.name}</h3>
                                <p class="text-[10px] uppercase tracking-wider opacity-40 font-bold">Employee ID: ${emp.id}</p>
                            </div>
                        </div>
                        <div class="grid grid-cols-5 gap-1">
                            ${[0, 0.5, 1, 1.5, 2].map(val => `
                                <button data-action="attendance-change" data-emp="${emp.id}" data-val="${val}" class="px-2 py-2 rounded-xl text-xs font-bold transition-all border ${state.attendance[emp.id] === val ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-200' : 'bg-[#F5F5F0] text-[#141414]/60 border-transparent hover:border-[#141414]/20'}">${val}</button>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        app.appendChild(container);

    } else if (state.view === 'stats') {
        container.innerHTML = `
            <header class="flex items-center justify-between">
                <div>
                    <h1 class="text-3xl font-serif italic tracking-tight">Monthly Stats</h1>
                    <p class="text-xs uppercase tracking-widest opacity-50 font-bold mt-1">월별 집계</p>
                </div>
                <div class="flex items-center gap-4 bg-white border border-[#141414]/10 rounded-full px-4 py-2">
                    <button data-action="change-month" data-value="-1" class="hover:text-emerald-600 transition-colors"><i data-lucide="chevron-left" class="pointer-events-none"></i></button>
                    <span class="font-mono text-sm font-bold">${formatKMonth(state.selectedMonth)}</span>
                    <button data-action="change-month" data-value="1" class="hover:text-emerald-600 transition-colors"><i data-lucide="chevron-right" class="pointer-events-none"></i></button>
                </div>
            </header>
            <div class="bg-white border border-[#141414]/10 rounded-3xl overflow-hidden">
                <div class="grid grid-cols-3 bg-[#141414] text-white p-4 text-[10px] uppercase tracking-widest font-bold">
                    <span>이름</span>
                    <span class="text-center">출근일수</span>
                    <span class="text-right">총 근무시간</span>
                </div>
                ${state.stats.length > 0 ? state.stats.map(s => `
                    <div class="grid grid-cols-3 p-6 border-b border-[#141414]/5 items-center last:border-0 hover:bg-[#F5F5F0]/50 transition-colors">
                        <span class="font-bold text-lg">${s.employee_name}</span>
                        <span class="text-center font-mono text-emerald-600 font-bold">${s.days}일</span>
                        <span class="text-right font-mono text-2xl font-light">${s.total}</span>
                    </div>
                `).join('') : '<div class="p-12 text-center opacity-40 italic">기록이 없습니다.</div>'}
            </div>
        `;
        app.appendChild(container);

    } else if (state.view === 'calendar') {
        container.className = 'space-y-8 max-w-none';
        const daysInMonth = new Date(parseInt(state.selectedMonth.split('-')[0]), parseInt(state.selectedMonth.split('-')[1]), 0).getDate();
        
        let calendarRows = '';
        for (let day = 1; day <= daysInMonth; day++) {
            const dateObj = new Date(parseInt(state.selectedMonth.split('-')[0]), parseInt(state.selectedMonth.split('-')[1]) - 1, day);
            const dateStr = `${state.selectedMonth}-${String(day).padStart(2, '0')}`;
            const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()];
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

            calendarRows += `
                <tr class="border-b border-[#141414]/5 hover:bg-[#F5F5F0]/50 transition-colors ${isWeekend ? 'bg-[#F5F5F0]/30' : ''}">
                    <td class="p-3 font-mono text-xs sticky left-0 bg-white border-r border-[#141414]/5 z-10">
                        <span class="${isWeekend ? 'text-red-500 font-bold' : ''}">${dateObj.getMonth() + 1}월 ${day}일 (${dayOfWeek})</span>
                    </td>
                    ${state.employees.map(emp => {
                        const record = state.monthlyRecords.find(r => r.employee_id === emp.id && r.date === dateStr);
                        return `
                            <td class="p-2 text-center border-l border-[#141414]/5 font-mono text-xs">
                                ${record ? `<span class="inline-block px-2 py-1 rounded-md font-bold ${
                                    record.value >= 1.5 ? 'bg-orange-100 text-orange-700' : 
                                    record.value === 1 ? 'bg-emerald-100 text-emerald-700' : 
                                    record.value === 0 ? 'bg-gray-100 text-gray-400' :
                                    'bg-blue-100 text-blue-700'
                                }">${record.value}</span>` : '-'}
                            </td>
                        `;
                    }).join('')}
                </tr>
            `;
        }

        container.innerHTML = `
            <header class="flex items-center justify-between">
                <div>
                    <h1 class="text-3xl font-serif italic tracking-tight">Monthly View</h1>
                    <p class="text-xs uppercase tracking-widest opacity-50 font-bold mt-1">한달 전체 기록</p>
                </div>
                <div class="flex items-center gap-4 bg-white border border-[#141414]/10 rounded-full px-4 py-2">
                    <button data-action="change-month" data-value="-1" class="hover:text-emerald-600 transition-colors"><i data-lucide="chevron-left" class="pointer-events-none"></i></button>
                    <span class="font-mono text-sm font-bold">${formatKMonth(state.selectedMonth)}</span>
                    <button data-action="change-month" data-value="1" class="hover:text-emerald-600 transition-colors"><i data-lucide="chevron-right" class="pointer-events-none"></i></button>
                </div>
            </header>
            <div class="bg-white border border-[#141414]/10 rounded-3xl overflow-x-auto">
                <table class="w-full border-collapse">
                    <thead>
                        <tr class="bg-[#141414] text-white text-[10px] uppercase tracking-widest font-bold">
                            <th class="p-4 text-left sticky left-0 bg-[#141414] z-10 min-w-[120px]">날짜</th>
                            ${state.employees.map(emp => `<th class="p-4 text-center border-l border-white/10 min-w-[60px]">${emp.name}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>${calendarRows}</tbody>
                </table>
            </div>
        `;
        app.appendChild(container);

    } else if (state.view === 'employees') {
        container.innerHTML = `
            <header>
                <h1 class="text-3xl font-serif italic tracking-tight">Employees</h1>
                <p class="text-xs uppercase tracking-widest opacity-50 font-bold mt-1">직원 관리</p>
            </header>
            <form id="add-emp-form" class="flex gap-2">
                <input type="text" id="new-emp-name" placeholder="새 직원 이름 입력" class="flex-1 bg-white border border-[#141414]/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-emerald-600 transition-colors font-bold">
                <button type="submit" class="bg-[#141414] text-white rounded-2xl px-6 py-4 hover:bg-emerald-600 transition-colors flex items-center gap-2">
                    <i data-lucide="user-plus" class="pointer-events-none"></i>
                    <span class="font-bold uppercase tracking-wider text-xs">추가</span>
                </button>
            </form>
            <div class="grid grid-cols-1 gap-4">
                ${state.employees.map(emp => `
                    <div class="bg-white border border-[#141414]/10 rounded-2xl p-6 flex items-center justify-between group">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full bg-[#141414]/5 flex items-center justify-center text-xl font-serif italic">${emp.name[0]}</div>
                            <span class="text-xl font-bold">${emp.name}</span>
                        </div>
                        <div class="flex items-center gap-4">
                            <div class="opacity-20 text-[10px] font-mono font-bold uppercase tracking-widest">ID: ${emp.id}</div>
                            <button data-id="${emp.id}" data-name="${emp.name}" class="delete-emp-btn p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="삭제">
                                <i data-lucide="trash-2" class="pointer-events-none"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        app.appendChild(container);

        document.getElementById('add-emp-form').onsubmit = (e) => {
            e.preventDefault();
            window.handleAddEmployee(document.getElementById('new-emp-name').value);
        };
    }

    // Re-initialize Lucide icons
    lucide.createIcons();

    // Attach Delete Listeners if in employees view (MUST BE AFTER lucide.createIcons)
    if (state.view === 'employees') {
        document.querySelectorAll('.delete-emp-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                const name = btn.getAttribute('data-name');
                window.handleDeleteEmployee(id, name);
            };
        });
    }

    // Update Nav Active State
    document.querySelectorAll('nav button').forEach(btn => {
        const view = btn.dataset.view;
        if (view === state.view) {
            btn.classList.add('text-emerald-600');
            btn.classList.remove('opacity-50');
        } else {
            btn.classList.remove('text-emerald-600');
            btn.classList.add('opacity-50');
        }
    });
}

// Global Event Listener for Actions
document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    const value = target.dataset.value;
    const id = target.dataset.id;
    const name = target.dataset.name;
    const empId = target.dataset.emp;
    const val = target.dataset.val;

    if (action === 'set-view') {
        window.setView(target.dataset.view);
    } else if (action === 'change-date') {
        window.changeDate(parseInt(value));
    } else if (action === 'change-month') {
        window.changeMonth(parseInt(value));
    } else if (action === 'attendance-change') {
        window.handleAttendanceChange(parseInt(empId), parseFloat(val));
    }
});

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    // Nav buttons use data-action now
    document.querySelectorAll('nav button').forEach(btn => {
        btn.dataset.action = 'set-view';
    });

    window.fetchEmployees();
    window.fetchAttendance(state.selectedDate);
});
