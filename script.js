// NOME DO ARQUIVO: script.js
// --- ESTADO GLOBAL DA APLICAÇÃO ---
let inventory = [];
let savedClients = [];
let orders = [];
let expenses = [];
let goals = [];


// --- LÓGICA GERAL E INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    const loader = document.getElementById('loader');
    const appContainer = document.getElementById('app-container');

    const initializeApp = async () => {
        try {
            // Carrega todos os dados da nuvem em paralelo
            await Promise.all([
                fetchInventory(),
                fetchClients(),
                fetchExpenses(),
                fetchOrders(),
                fetchGoals()
            ]);

            // Esconde o loader e mostra a aplicação
            loader.style.display = 'none';
            appContainer.style.display = 'block';

            // Renderiza todos os componentes com os dados frescos
            renderAllComponents();

        } catch (error) {
            console.error("Erro ao inicializar a app:", error);
            loader.querySelector('p').textContent = "Erro ao carregar dados. Tente novamente.";
            alert("Não foi possível carregar os dados. Verifica a tua ligação e a configuração do back-end.");
        }
    };

    // Função central para renderizar tudo
    const renderAllComponents = () => {
        renderInventory();
        renderClients();
        renderExpenses();
        renderOrders();
        renderGoals(); // Deve ser antes do dashboard
        updateDashboard();
        renderCharts();
    };

    const tabs = document.querySelectorAll('.tab');
    const contents = document.querySelectorAll('.content');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(item => item.classList.remove('active'));
            contents.forEach(item => item.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.target).classList.add('active');
        });
    });

    const formatCurrency = value => `R$ ${parseFloat(value).toFixed(2).replace('.', ',')}`;

    // --- CALCULADORA (Permanece local) ---
    const custoPecaInput = document.getElementById('custo-peca');
    const custoExtraInput = document.getElementById('custo-extra');
    const margemLucroInput = document.getElementById('margem-lucro');
    const calcularBtn = document.getElementById('btn-calcular');
    const resultsContainer = document.getElementById('results-container');
    const custoTotalSpan = document.getElementById('custo-total-valor');
    const lucroBrutoSpan = document.getElementById('lucro-bruto-valor');
    const precoVendaSpan = document.getElementById('preco-venda-valor');

    calcularBtn.addEventListener('click', () => {
        const custoPeca = parseFloat(custoPecaInput.value) || 0;
        const custoExtra = parseFloat(custoExtraInput.value) || 0;
        const margemLucro = parseFloat(margemLucroInput.value) || 0;
        if (custoPeca <= 0) {
            alert('Por favor, insere um custo válido para a peça.');
            return;
        }
        const custoTotal = custoPeca + custoExtra;
        const precoDeVenda = custoTotal * (1 + margemLucro / 100);
        const lucroBruto = precoDeVenda - custoTotal;
        custoTotalSpan.textContent = formatCurrency(custoTotal);
        lucroBrutoSpan.textContent = formatCurrency(lucroBruto);
        precoVendaSpan.textContent = formatCurrency(precoDeVenda);
        resultsContainer.style.display = 'block';
    });

    // --- CONTROLO DE STOCK ---
    const productNameInput = document.getElementById('product-name');
    const productCostInput = document.getElementById('product-cost');
    const productQuantityInput = document.getElementById('product-quantity');
    const addProductBtn = document.getElementById('add-product-btn');
    const inventoryTableBody = document.querySelector('#inventory-table tbody');
    const noStockMessage = document.getElementById('no-stock-message');
    const orderProductSelect = document.getElementById('order-product-select');

    const fetchInventory = async () => {
        const response = await fetch('/api/inventory');
        if (!response.ok) throw new Error('Falha ao procurar o stock');
        inventory = await response.json();
    };

    const renderInventory = () => {
        inventoryTableBody.innerHTML = '';
        orderProductSelect.innerHTML = '<option value="">Seleciona um produto</option>';
        noStockMessage.style.display = inventory.length === 0 ? 'block' : 'none';
        inventoryTableBody.closest('table').style.display = inventory.length === 0 ? 'none' : 'table';

        inventory.sort((a, b) => a.name.localeCompare(b.name));

        inventory.forEach(product => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${product.name}</td>
                <td>${formatCurrency(product.cost)}</td>
                <td>
                    <div class="stock-controls">
                        <button class="stock-btn" data-id="${product.id}" data-action="decrease">-</button>
                        <span>${product.quantity}</span>
                        <button class="stock-btn" data-id="${product.id}" data-action="increase">+</button>
                    </div>
                </td>
                <td><button class="delete-btn" data-id="${product.id}">X</button></td>
            `;
            inventoryTableBody.appendChild(row);
            if (product.quantity > 0) {
                const option = new Option(`${product.name} (${product.quantity} disp.)`, product.name);
                orderProductSelect.appendChild(option);
            }
        });
    };

    addProductBtn.addEventListener('click', async () => {
        const name = productNameInput.value.trim();
        const cost = parseFloat(productCostInput.value) || 0;
        const quantity = parseInt(productQuantityInput.value);
        if (name && cost > 0 && quantity >= 0) {
            const response = await fetch('/api/inventory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, cost, quantity })
            });
            if (response.ok) {
                await fetchInventory();
                renderInventory();
                productNameInput.value = ''; productCostInput.value = ''; productQuantityInput.value = '';
            } else { alert('Falha ao adicionar o produto.'); }
        } else { alert('Por favor, preenche todos os campos do produto corretamente.'); }
    });

    inventoryTableBody.addEventListener('click', async e => {
        const { id, action } = e.target.dataset;
        if (!id) return;

        const product = inventory.find(p => p.id == id);

        if (e.target.classList.contains('stock-btn')) {
            let newQuantity = product.quantity;
            if (action === 'increase') newQuantity++;
            else if (action === 'decrease' && product.quantity > 0) newQuantity--;

            const response = await fetch(`/api/inventory`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, quantity: newQuantity })
            });
            if (response.ok) { await fetchInventory(); renderAllComponents(); }
            else { alert('Falha ao atualizar a quantidade.'); }
        }
        if (e.target.classList.contains('delete-btn')) {
            if (confirm(`Tens a certeza que queres remover "${product.name}"?`)) {
                const response = await fetch(`/api/inventory`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                });
                if (response.ok) { await fetchInventory(); renderAllComponents(); }
                else { alert('Falha ao apagar o produto.'); }
            }
        }
    });

    // --- CLIENTES ---
    const clientNameInput = document.getElementById('client-name-input');
    const clientNumberInput = document.getElementById('client-number-input');
    const addClientBtn = document.getElementById('btn-add-client');
    const clientList = document.getElementById('client-list');
    const orderClientSelect = document.getElementById('order-client-select');
    const noClientsMessage = document.getElementById('no-clients-message');

    const fetchClients = async () => {
        const response = await fetch('/api/clients');
        if (!response.ok) throw new Error('Falha ao procurar os clientes');
        savedClients = await response.json();
    };

    const renderClients = () => {
        clientList.innerHTML = '';
        orderClientSelect.innerHTML = '<option value="">Seleciona um cliente</option>';
        noClientsMessage.style.display = savedClients.length === 0 ? 'list-item' : 'none';

        savedClients.sort((a, b) => a.name.localeCompare(b.name));

        savedClients.forEach(client => {
            clientList.innerHTML += `<li><span>${client.name} (${client.number})</span> <button class="delete-btn" data-id="${client.id}">X</button></li>`;
            orderClientSelect.appendChild(new Option(client.name, client.name));
        });
    };

    addClientBtn.addEventListener('click', async () => {
        const name = clientNameInput.value.trim();
        const number = clientNumberInput.value.trim().replace(/\D/g, '');
        if (name && number) {
            const response = await fetch('/api/clients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, number })
            });
            if (response.ok) {
                await fetchClients(); renderClients();
                clientNameInput.value = ''; clientNumberInput.value = '';
            } else { alert('Falha ao guardar o cliente.'); }
        } else { alert('Preenche o nome e o número do cliente.'); }
    });

    clientList.addEventListener('click', async e => {
        const { id } = e.target.dataset;
        if (e.target.classList.contains('delete-btn') && id) {
            const client = savedClients.find(c => c.id == id);
            if (confirm(`Remover "${client.name}" da lista?`)) {
                const response = await fetch('/api/clients', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                });
                if (response.ok) { await fetchClients(); renderClients(); }
                else { alert('Falha ao apagar o cliente.'); }
            }
        }
    });

    // --- LÓGICA DE PEDIDOS ---
    const addOrderBtn = document.getElementById('btn-add-order');
    const orderQuantityInput = document.getElementById('order-quantity');
    const orderValueInput = document.getElementById('order-value');
    const ordersTableBody = document.querySelector('#orders-table tbody');
    const noOrdersMessage = document.getElementById('no-orders-message');

    const fetchOrders = async () => {
        const response = await fetch('/api/orders');
        if (!response.ok) throw new Error('Falha ao procurar os pedidos');
        orders = await response.json();
    };

    const renderOrders = () => {
        ordersTableBody.innerHTML = '';
        noOrdersMessage.style.display = orders.length === 0 ? 'block' : 'none';
        ordersTableBody.closest('table').style.display = orders.length === 0 ? 'none' : 'table';

        orders.sort((a, b) => b.id - a.id); // Mostra os mais recentes primeiro

        orders.forEach(order => {
            const row = document.createElement('tr');
            const itemsText = `${order.product_name} (x${order.quantity})`;
            row.innerHTML = `
                <td>${order.client_name}</td>
                <td>${itemsText}</td>
                <td>${formatCurrency(order.value)}</td>
                <td><span class="order-status status-${order.status}" data-id="${order.id}">${order.status.replace('-', ' ')}</span></td>
                <td><button class="delete-btn" data-id="${order.id}">X</button></td>
            `;
            ordersTableBody.appendChild(row);
        });
    };

    addOrderBtn.addEventListener('click', async () => {
        const client_name = orderClientSelect.value;
        const product_name = orderProductSelect.value;
        const quantity = parseInt(orderQuantityInput.value);
        const value = parseFloat(orderValueInput.value);

        if (!client_name || !product_name || !quantity || !value) {
            alert('Preenche todos os campos do pedido.');
            return;
        }

        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_name, product_name, quantity, value })
        });

        if (response.ok) {
            orderClientSelect.value = '';
            orderProductSelect.value = '';
            orderQuantityInput.value = '1';
            orderValueInput.value = '';
            await Promise.all([fetchOrders(), fetchInventory()]); // Atualiza pedidos e stock
            renderAllComponents();
        } else {
            const error = await response.json();
            alert(`Erro ao adicionar pedido: ${error.message}`);
        }
    });

    ordersTableBody.addEventListener('click', async e => {
        const { id } = e.target.dataset;
        if (!id) return;

        const order = orders.find(o => o.id == id);

        if (e.target.classList.contains('order-status')) {
            const statuses = ['pending', 'paid', 'sent'];
            const currentStatusIndex = statuses.indexOf(order.status);
            const nextStatus = statuses[(currentStatusIndex + 1) % statuses.length];

            const response = await fetch('/api/orders', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status: nextStatus })
            });
            if (response.ok) { await fetchOrders(); renderAllComponents(); }
            else { alert('Falha ao atualizar o status.'); }
        }

        if (e.target.classList.contains('delete-btn')) {
            if (confirm(`Tens a certeza que queres remover o pedido de ${order.client_name}? ISTO IRÁ DEVOLVER OS ITENS AO STOCK.`)) {
                const response = await fetch('/api/orders', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, product_name: order.product_name, quantity: order.quantity })
                });

                if (response.ok) {
                    await Promise.all([fetchOrders(), fetchInventory()]);
                    renderAllComponents();
                } else {
                    alert('Falha ao apagar o pedido.');
                }
            }
        }
    });

    // --- LÓGICA DE DESPESAS ---
    const expenseDescriptionInput = document.getElementById('expense-description');
    const expenseValueInput = document.getElementById('expense-value');
    const addExpenseBtn = document.getElementById('btn-add-expense');
    const expensesTableBody = document.querySelector('#expenses-table tbody');
    const noExpensesMessage = document.getElementById('no-expenses-message');

    const fetchExpenses = async () => {
        const response = await fetch('/api/expenses');
        if (!response.ok) throw new Error('Falha ao procurar as despesas');
        expenses = await response.json();
    };

    const renderExpenses = () => {
        expensesTableBody.innerHTML = '';
        noExpensesMessage.style.display = expenses.length === 0 ? 'block' : 'none';
        expensesTableBody.closest('table').style.display = expenses.length === 0 ? 'none' : 'table';

        expenses.sort((a, b) => b.id - a.id);

        expenses.forEach(expense => {
            expensesTableBody.innerHTML += `
                <tr>
                    <td>${expense.description}</td>
                    <td>${formatCurrency(expense.value)}</td>
                    <td><button class="delete-btn" data-id="${expense.id}">X</button></td>
                </tr>
            `;
        });
    };

    addExpenseBtn.addEventListener('click', async () => {
        const description = expenseDescriptionInput.value.trim();
        const value = parseFloat(expenseValueInput.value);
        if (description && value > 0) {
            const response = await fetch('/api/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description, value })
            });
            if (response.ok) {
                await fetchExpenses();
                renderAllComponents();
                expenseDescriptionInput.value = '';
                expenseValueInput.value = '';
            } else { alert('Falha ao adicionar a despesa.'); }
        } else { alert('Preenche a descrição e um valor válido para a despesa.'); }
    });

    expensesTableBody.addEventListener('click', async e => {
        const { id } = e.target.dataset;
        if (e.target.classList.contains('delete-btn') && id) {
            const expense = expenses.find(ex => ex.id == id);
            if (confirm(`Remover a despesa "${expense.description}"?`)) {
                const response = await fetch('/api/expenses', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                });
                if (response.ok) {
                    await fetchExpenses();
                    renderAllComponents();
                } else { alert('Falha ao apagar a despesa.'); }
            }
        }
    });

    // --- DASHBOARD ---
    const totalOrdersValue = document.getElementById('total-orders-value');
    const totalRevenueValue = document.getElementById('total-revenue-value');
    const totalExpensesValue = document.getElementById('total-expenses-value');
    const netProfitValue = document.getElementById('net-profit-value');
    const topProductValue = document.getElementById('top-product-value');

    const updateDashboard = () => {
        // 1. Total de Pedidos
        totalOrdersValue.textContent = orders.length;

        // 2. Faturação Total
        const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.value), 0);
        totalRevenueValue.textContent = formatCurrency(totalRevenue);

        // 3. Custo dos Produtos Vendidos (CPV)
        const totalCostOfGoods = orders.reduce((sum, order) => {
            const product = inventory.find(p => p.name === order.product_name);
            const cost = product ? parseFloat(product.cost) : 0;
            return sum + (cost * order.quantity);
        }, 0);

        // 4. Despesas Totais
        const totalExpenses = expenses.reduce((sum, expense) => sum + parseFloat(expense.value), 0);
        totalExpensesValue.textContent = formatCurrency(totalExpenses);

        // 5. Lucro Líquido
        const netProfit = totalRevenue - totalCostOfGoods - totalExpenses;
        netProfitValue.textContent = formatCurrency(netProfit);

        // 6. Produto Mais Vendido
        if (orders.length === 0) {
            topProductValue.textContent = '-';
        } else {
            const productCounts = orders.reduce((counts, order) => {
                counts[order.product_name] = (counts[order.product_name] || 0) + order.quantity;
                return counts;
            }, {});
            const topProduct = Object.keys(productCounts).reduce((a, b) => productCounts[a] > productCounts[b] ? a : b, Object.keys(productCounts)[0]);
            topProductValue.textContent = topProduct || '-';
        }
    };

    // --- RELATÓRIOS ---
    const chartCtx = document.getElementById('financial-chart').getContext('2d');
    let financialChart;

    const renderCharts = () => {
        const sortedOrders = [...orders].sort((a, b) => a.id - b.id);
        const labels = sortedOrders.map((_, index) => `Pedido ${index + 1}`);
        let cumulativeRevenue = 0;
        const revenueData = sortedOrders.map(order => cumulativeRevenue += parseFloat(order.value));

        let cumulativeProfit = 0;
        const totalExpenses = expenses.reduce((sum, expense) => sum + parseFloat(expense.value), 0);

        const profitData = sortedOrders.map(order => {
            const product = inventory.find(p => p.name === order.product_name);
            const cost = product ? parseFloat(product.cost) : 0;
            const orderProfit = parseFloat(order.value) - (cost * order.quantity);
            cumulativeProfit += orderProfit;
            return cumulativeProfit;
        }).map(profit => profit - totalExpenses);

        if (financialChart) financialChart.destroy();
        financialChart = new Chart(chartCtx, { type: 'line', data: { labels, datasets: [{ label: 'Faturação Acumulada', data: revenueData, borderColor: 'rgba(74, 124, 117, 1)', backgroundColor: 'rgba(74, 124, 117, 0.2)', fill: true, tension: 0.1 }, { label: 'Lucro Líquido Acumulado', data: profitData, borderColor: 'rgba(40, 167, 69, 1)', backgroundColor: 'rgba(40, 167, 69, 0.2)', fill: true, tension: 0.1 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { callback: value => 'R$ ' + value } } } } });
    };

    // --- METAS ---
    const goalDescriptionInput = document.getElementById('goal-description');
    const goalTypeSelect = document.getElementById('goal-type');
    const goalValueInput = document.getElementById('goal-value');
    const addGoalBtn = document.getElementById('btn-add-goal');
    const goalsContainer = document.getElementById('goals-container');
    const noGoalsMessage = document.getElementById('no-goals-message');

    const fetchGoals = async () => {
        const response = await fetch('/api/goals');
        if (!response.ok) throw new Error('Falha ao procurar as metas');
        goals = await response.json();
    };

    const renderGoals = () => {
        goalsContainer.innerHTML = '';
        noGoalsMessage.style.display = goals.length === 0 ? 'block' : 'none';

        const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.value), 0);
        const totalCostOfGoods = orders.reduce((sum, order) => {
            const product = inventory.find(p => p.name === order.product_name);
            return sum + (product ? parseFloat(product.cost) : 0) * order.quantity;
        }, 0);
        const totalExpenses = expenses.reduce((sum, expense) => sum + parseFloat(expense.value), 0);
        const netProfit = totalRevenue - totalCostOfGoods - totalExpenses;
        const totalOrdersCount = orders.length;

        goals.forEach(goal => {
            let currentValue = 0;
            let isCurrency = true;
            if (goal.type === 'faturamento') currentValue = totalRevenue;
            else if (goal.type === 'lucro') currentValue = netProfit;
            else { currentValue = totalOrdersCount; isCurrency = false; }

            const progress = (currentValue / parseFloat(goal.value)) * 100;
            const card = document.createElement('div');
            card.className = 'goal-card';
            card.innerHTML = `
                <div class="goal-header">
                    <h4>${goal.description}</h4>
                    <button class="delete-btn" data-id="${goal.id}">X</button>
                </div>
                <div class="goal-progress">
                    <div class="progress-bar" style="width: ${Math.min(progress, 100)}%;">${progress.toFixed(1)}%</div>
                </div>
                <div class="goal-details">
                    ${isCurrency ? formatCurrency(currentValue) : currentValue} de ${isCurrency ? formatCurrency(parseFloat(goal.value)) : goal.value}
                </div>
            `;
            goalsContainer.appendChild(card);
        });
    };

    addGoalBtn.addEventListener('click', async () => {
        const description = goalDescriptionInput.value.trim();
        const type = goalTypeSelect.value;
        const value = parseFloat(goalValueInput.value);
        if (description && type && value > 0) {
            const response = await fetch('/api/goals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description, type, value })
            });
            if (response.ok) {
                await fetchGoals();
                renderAllComponents();
                goalDescriptionInput.value = '';
                goalValueInput.value = '';
            } else { alert('Falha ao adicionar a meta.'); }
        } else { alert('Preenche todos os campos da meta corretamente.'); }
    });

    goalsContainer.addEventListener('click', async e => {
        const { id } = e.target.dataset;
        if (e.target.classList.contains('delete-btn') && id) {
            const goal = goals.find(g => g.id == id);
            if (confirm(`Tens a certeza que queres remover a meta "${goal.description}"?`)) {
                const response = await fetch('/api/goals', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                });
                if (response.ok) {
                    await fetchGoals();
                    renderAllComponents();
                } else { alert('Falha ao apagar a meta.'); }
            }
        }
    });

    // --- INICIALIZAÇÃO DA APP ---
    initializeApp();
});

