document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logout-btn');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const panels = document.querySelectorAll('.panel');
    const createPlayerForm = document.getElementById('create-player-form');

    // Modal elements
    const editModal = document.getElementById('edit-modal');
    const passwordModal = document.getElementById('password-modal');
    const editPlayerForm = document.getElementById('edit-player-form');
    const passwordResetForm = document.getElementById('password-reset-form');
    
    let allData = {
        players: [],
        transactions: [],
        audits: []
    };

    let tableStates = {
        players: { sortCol: 'created_at', sortDir: 'desc', currentPage: 1, rowsPerPage: 10, filter: '', selected: new Set() },
        transactions: { sortCol: 'timestamp', sortDir: 'desc', currentPage: 1, rowsPerPage: 10, filter: '', selected: new Set() },
        audits: { sortCol: 'timestamp', sortDir: 'desc', currentPage: 1, rowsPerPage: 10, filter: '', selected: new Set() }
    };

    const api = {
        logout: async () => await fetch('/api/logout', { method: 'POST' }),
        getPlayers: async () => await fetch('/api/admin/players').then(res => res.json()),
        getTransactions: async () => await fetch('/api/admin/transactions').then(res => res.json()),
        getAdminActions: async () => await fetch('/api/admin/admin-actions').then(res => res.json()),
        createPlayer: async (data) => await fetch('/api/admin/players', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
        updatePlayer: async (id, data) => await fetch(`/api/admin/players/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    };

    const renderTable = (tableName) => {
        const state = tableStates[tableName];
        const data = allData[tableName];
        const tableBody = document.getElementById(`${tableName}-table-body`);
        if (!tableBody) return;

        const filteredData = data.filter(item => 
            Object.values(item).some(val => 
                String(val).toLowerCase().includes(state.filter.toLowerCase())
            )
        );

        filteredData.sort((a, b) => {
            const valA = a[state.sortCol];
            const valB = b[state.sortCol];
            if (valA < valB) return state.sortDir === 'asc' ? -1 : 1;
            if (valA > valB) return state.sortDir === 'asc' ? 1 : -1;
            return 0;
        });
        
        const paginatedData = filteredData.slice((state.currentPage - 1) * state.rowsPerPage, state.currentPage * state.rowsPerPage);
        
        tableBody.innerHTML = '';
        paginatedData.forEach(item => {
            let row;
            if (tableName === 'players') row = createPlayerRow(item);
            else if (tableName === 'transactions') row = createTransactionRow(item);
            else if (tableName === 'audits') row = createAuditRow(item);
            
            if (row && state.selected.has(item.id)) {
                row.classList.add('selected');
                const checkbox = row.querySelector('input[type="checkbox"]');
                if(checkbox) checkbox.checked = true;
            }
            if(row) tableBody.appendChild(row);
        });
        
        renderPagination(tableName, filteredData.length);
        updateSelectAllCheckbox(tableName);
    };

    const createPlayerRow = (player) => {
        const row = document.createElement('tr');
        row.dataset.id = player.id;
        row.innerHTML = `
            <td><input type="checkbox" data-id="${player.id}"></td>
            <td>${player.id}</td>
            <td>${player.username}</td>
            <td>${player.balance}</td>
            <td><span class="status-${player.is_banned ? 'banned' : 'active'}">${player.is_banned ? 'Banned' : 'Active'}</span></td>
            <td>${new Date(player.created_at).toLocaleString()}</td>
            <td>
                <button class="action-btn btn-edit" data-id="${player.id}" data-username="${player.username}" data-balance="${player.balance}">Edit Balance</button>
                <button class="action-btn btn-password" data-id="${player.id}" data-username="${player.username}">Reset PW</button>
                <button class="action-btn ${player.is_banned ? 'btn-unban' : 'btn-ban'}" data-id="${player.id}" data-banned="${player.is_banned}">
                    ${player.is_banned ? 'Unban' : 'Ban'}
                </button>
            </td>
        `;
        return row;
    };

    const createTransactionRow = (trx) => {
        const row = document.createElement('tr');
        row.dataset.id = trx.id;
        row.innerHTML = `
            <td><input type="checkbox" data-id="${trx.id}"></td>
            <td>${trx.player_id}</td>
            <td>${trx.game}</td>
            <td>${trx.amount_wagered}</td>
            <td>${trx.outcome_amount}</td>
            <td>${new Date(trx.transaction_date).toLocaleString()}</td>`;
        return row;
    };
    
    const createAuditRow = (audit) => {
        const row = document.createElement('tr');
        row.dataset.id = audit.id;
        row.innerHTML = `
            <td><input type="checkbox" data-id="${audit.id}"></td>
            <td>${audit.admin_username || 'N/A'}</td>
            <td>${audit.target_player_id || 'N/A'}</td>
            <td>${audit.action}</td>
            <td>${new Date(audit.action_timestamp).toLocaleString()}</td>`;
        return row;
    };

    const renderPagination = (tableName, totalItems) => {
        const state = tableStates[tableName];
        const paginationContainer = document.getElementById(`${tableName}-pagination`);
        if (!paginationContainer) return;
        
        const totalPages = Math.ceil(totalItems / state.rowsPerPage);
        paginationContainer.innerHTML = `
            <button class="pagination-btn" data-page="prev" ${state.currentPage === 1 ? 'disabled' : ''}>Prev</button>
            <span>Page ${state.currentPage} of ${totalPages || 1}</span>
            <button class="pagination-btn" data-page="next" ${state.currentPage >= totalPages ? 'disabled' : ''}>Next</button>
        `;
    };

    const setupTableEventListeners = (tableName) => {
        const state = tableStates[tableName];
        const table = document.getElementById(`${tableName}-table`);
        const searchInput = document.getElementById(`${tableName}-search`);
        const paginationContainer = document.getElementById(`${tableName}-pagination`);

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                state.filter = e.target.value;
                state.currentPage = 1;
                renderTable(tableName);
            });
        }

        if (table) {
            const thead = table.querySelector('thead');
            if(thead) {
                thead.addEventListener('click', e => {
                    if (e.target.matches('th[data-column]')) {
                        const column = e.target.dataset.column;
                        if (state.sortCol === column) {
                            state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
                        } else {
                            state.sortCol = column;
                            state.sortDir = 'desc';
                        }
                        renderTable(tableName);
                    } else if (e.target.matches('input[type="checkbox"]')) {
                        const isChecked = e.target.checked;
                        const checkboxes = table.querySelectorAll('tbody input[type="checkbox"]');
                        checkboxes.forEach(checkbox => {
                            const id = parseInt(checkbox.dataset.id);
                            if(isChecked) {
                                state.selected.add(id);
                                checkbox.closest('tr').classList.add('selected');
                            } else {
                                state.selected.delete(id);
                                checkbox.closest('tr').classList.remove('selected');
                            }
                            checkbox.checked = isChecked;
                        });
                    }
                });
            }

            const tbody = table.querySelector('tbody');
            if(tbody) {
                tbody.addEventListener('click', e => {
                    const target = e.target;
                    if(target.matches('input[type="checkbox"]')) {
                        const id = parseInt(target.dataset.id);
                        if(target.checked) {
                            state.selected.add(id);
                            target.closest('tr').classList.add('selected');
                        } else {
                            state.selected.delete(id);
                            target.closest('tr').classList.remove('selected');
                        }
                        updateSelectAllCheckbox(tableName);
                    } else if(target.closest('.action-btn')) {
                        const actionBtn = target.closest('.action-btn');
                        const id = actionBtn.dataset.id;
                        if(actionBtn.matches('.btn-edit')) {
                            openModal(editModal, id, actionBtn.dataset.username, actionBtn.dataset.balance);
                        } else if (actionBtn.matches('.btn-password')) {
                            openModal(passwordModal, id, actionBtn.dataset.username);
                        } else if (actionBtn.matches('.btn-ban')) {
                            toggleBan(id, true);
                        } else if (actionBtn.matches('.btn-unban')) {
                            toggleBan(id, false);
                        }
                    }
                });
            }
        }
        
        if (paginationContainer) {
            paginationContainer.addEventListener('click', e => {
                if(e.target.matches('.pagination-btn')) {
                    const direction = e.target.dataset.page;
                    if (direction === 'prev') state.currentPage--;
                    if (direction === 'next') state.currentPage++;
                    renderTable(tableName);
                }
            });
        }
    };
    
    const updateSelectAllCheckbox = (tableName) => {
        const table = document.getElementById(`${tableName}-table`);
        if(!table) return;
        const selectAll = table.querySelector('thead input[type="checkbox"]');
        if(!selectAll) return;
        const checkboxes = Array.from(table.querySelectorAll('tbody input[type="checkbox"]'));
        if(checkboxes.length > 0 && checkboxes.every(c => c.checked)) {
            selectAll.checked = true;
        } else {
            selectAll.checked = false;
        }
    };

    const toggleBan = async (playerId, isBanned) => {
        const player = allData.players.find(p => p.id == playerId);
        if (player) {
            await api.updatePlayer(playerId, { is_banned: isBanned });
            player.is_banned = isBanned;
            renderTable('players');
        }
    };

    const openModal = (modal, id, username, balance) => {
        if(modal === editModal) {
            modal.querySelector('#edit-player-id').value = id;
            modal.querySelector('#edit-username').textContent = username;
            modal.querySelector('#edit-balance').value = parseFloat(balance);
        } else if (modal === passwordModal) {
            modal.querySelector('#password-player-id').value = id;
            modal.querySelector('#password-username').textContent = username;
        }
        modal.style.display = 'block';
    };

    const closeModal = (modal) => {
        modal.style.display = 'none';
        const msg = modal.querySelector('.message');
        if(msg) {
            msg.textContent = '';
            msg.className = 'message';
        }
        const form = modal.querySelector('form');
        if(form) form.reset();
    };
    
    const showMessage = (element, message, isSuccess) => {
        element.textContent = message;
        element.className = `message ${isSuccess ? 'success' : 'error'}`;
        setTimeout(() => { element.textContent = ''; element.className = 'message';}, 3000);
    };

    const init = async () => {
        logoutBtn.addEventListener('click', async () => {
            await api.logout();
            window.location.href = '/';
        });
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                panels.forEach(panel => panel.classList.remove('active'));
                document.getElementById(`${button.dataset.tab}-panel`).classList.add('active');
            });
        });

        createPlayerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = { username: e.target['new-username'].value, password: e.target['new-password'].value, balance: 0 };
            const result = await api.createPlayer(data);
            const response = await result.json();
            showMessage(document.getElementById('create-message'), response.message, result.ok);
            if (result.ok) {
                e.target.reset();
                allData.players = await api.getPlayers();
                renderTable('players');
            }
        });
        
        editPlayerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = e.target['edit-player-id'].value;
            const balance = parseFloat(e.target['edit-balance'].value);
            const result = await api.updatePlayer(id, { balance });
            const response = await result.json();
            showMessage(editModal.querySelector('.message'), response.message, result.ok);
            if(result.ok) {
                const player = allData.players.find(p => p.id == id);
                if(player) player.balance = balance;
                renderTable('players');
                setTimeout(() => closeModal(editModal), 1500);
            }
        });
        
        passwordResetForm.addEventListener('submit', async(e) => {
            e.preventDefault();
            const id = e.target['password-player-id'].value;
            const password = e.target['new-reset-password'].value;
            const result = await api.updatePlayer(id, { password });
            const response = await result.json();
            showMessage(passwordModal.querySelector('.message'), response.message, result.ok);
            if(result.ok) {
                setTimeout(() => closeModal(passwordModal), 1500);
            }
        });


        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalId = e.target.dataset.modal;
                closeModal(document.getElementById(modalId));
            });
        });
        window.addEventListener('click', (e) => { 
            if (e.target.classList.contains('modal')) {
                closeModal(e.target);
            }
        });

        ['players', 'transactions', 'audits'].forEach(setupTableEventListeners);

        try {
            const results = await Promise.allSettled([
                api.getPlayers(),
                api.getTransactions(),
                api.getAdminActions()
            ]);

            if (results[0].status === 'fulfilled') {
                allData.players = results[0].value;
                renderTable('players');
            } else {
                console.error("Failed to load players:", results[0].reason);
            }

            if (results[1].status === 'fulfilled') {
                allData.transactions = results[1].value;
                renderTable('transactions');
            } else {
                console.error("Failed to load transactions:", results[1].reason);
            }

            if (results[2].status === 'fulfilled') {
                allData.audits = results[2].value;
                renderTable('audits');
            } else {
                console.error("Failed to load audits:", results[2].reason);
            }

        } catch (error) {
            console.error("An unexpected error occurred during initial data load:", error);
            // Optionally show a general error message to the admin
        }
    };

    init();
});

