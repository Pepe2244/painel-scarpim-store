// --- ESTADO GLOBAL DA APLICAÇÃO ---
let inventory = [];
let savedClients = [];
let savedMessages = JSON.parse(localStorage.getItem('scarpim_messages_local')) || []; // Templates de msg podem continuar locais
let orders = [];
let expenses = [];
let goals = [];


// --- LÓGICA GERAL E INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    const loader = document.getElementById('loader');
    const appContainer = document.getElementById('app-container');

    const initializeApp = async () => {
        try {
            await Promise.all([
                fetchInventory(),
                fetchClients()
                // Futuramente: fetchOrders(), etc.
            ]);

            loader.style.display = 'none';
            appContainer.style.display = 'block';

            renderInventory();
            renderClients();
            renderMessages(); // Renderiza as mensagens locais
            // Futuramente: renderOrders(), etc.

        } catch (error) {
            console.error("Erro ao inicializar a app:", error);
            alert("Não foi possível carregar os dados. Verifica a tua ligação e a configuração do back-end.");
        }
    };

    // --- LÓGICA GERAL (Separadores) ---
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

    // --- LÓGICA DA CALCULADORA (Permanece igual) ---
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

    // --- LÓGICA DO CONTROLO DE STOCK (API) ---
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
        // updateDashboard(); 
    };

    addProductBtn.addEventListener('click', async () => {
        const name = productNameInput.value.trim();
        const cost = parseFloat(productCostInput.value) || 0;
        const quantity = parseInt(productQuantityInput.value);
        if (name && cost > 0 && quantity >= 0) {
            const newProduct = { name, cost, quantity };
            const response = await fetch('/api/inventory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newProduct)
            });
            if (response.ok) {
                await fetchInventory();
                renderInventory();
                productNameInput.value = '';
                productCostInput.value = '';
                productQuantityInput.value = '';
            } else {
                alert('Falha ao adicionar o produto.');
            }
        } else {
            alert('Por favor, preenche todos os campos do produto corretamente.');
        }
    });

    inventoryTableBody.addEventListener('click', async e => {
        const target = e.target;
        const productId = target.dataset.id;
        if (!productId) return;

        const product = inventory.find(p => p.id == productId);

        if (target.classList.contains('stock-btn')) {
            const action = target.dataset.action;
            let newQuantity = product.quantity;
            if (action === 'increase') newQuantity++;
            else if (action === 'decrease' && product.quantity > 0) newQuantity--;

            const response = await fetch(`/api/inventory`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: productId, quantity: newQuantity })
            });
            if (response.ok) {
                await fetchInventory();
                renderInventory();
            } else {
                alert('Falha ao atualizar a quantidade.');
            }
        }
        if (target.classList.contains('delete-btn')) {
            if (confirm(`Tens a certeza que queres remover "${product.name}"?`)) {
                const response = await fetch(`/api/inventory`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: productId })
                });
                if (response.ok) {
                    await fetchInventory();
                    renderInventory();
                } else {
                    alert('Falha ao apagar o produto.');
                }
            }
        }
    });

    // --- LÓGICA DO WHATSAPP E CLIENTES (API) ---
    const clientSelect = document.getElementById('client-select');
    const whatsappNumberInput = document.getElementById('whatsapp-number');
    const clientNameInput = document.getElementById('client-name-input');
    const clientNumberInput = document.getElementById('client-number-input');
    const addClientBtn = document.getElementById('btn-add-client');
    const clientList = document.getElementById('client-list');
    const orderClientSelect = document.getElementById('order-client-select');

    const fetchClients = async () => {
        const response = await fetch('/api/clients');
        if (!response.ok) throw new Error('Falha ao procurar os clientes');
        savedClients = await response.json();
    };

    const renderClients = () => {
        clientList.innerHTML = '';
        clientSelect.innerHTML = '<option value="">Seleciona um cliente</option>';
        orderClientSelect.innerHTML = '<option value="">Seleciona um cliente</option>';

        savedClients.sort((a, b) => a.name.localeCompare(b.name));

        savedClients.forEach(client => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `<span>${client.name}</span> <button class="delete-btn" data-id="${client.id}">X</button>`;
            clientList.appendChild(listItem);

            const optionItem = new Option(client.name, client.name);
            clientSelect.appendChild(optionItem);

            const orderOptionItem = new Option(client.name, client.name);
            orderClientSelect.appendChild(orderOptionItem);
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
                await fetchClients();
                renderClients();
                clientNameInput.value = '';
                clientNumberInput.value = '';
            } else {
                alert('Falha ao guardar o cliente.');
            }
        } else {
            alert('Preenche o nome e o número do cliente.');
        }
    });

    clientList.addEventListener('click', async e => {
        const clientId = e.target.dataset.id;
        if (e.target.classList.contains('delete-btn') && clientId) {
            const client = savedClients.find(c => c.id == clientId);
            if (confirm(`Remover "${client.name}" da lista?`)) {
                const response = await fetch('/api/clients', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: clientId })
                });
                if (response.ok) {
                    await fetchClients();
                    renderClients();
                } else {
                    alert('Falha ao apagar o cliente.');
                }
            }
        }
    });

    clientSelect.addEventListener('change', () => {
        const selectedClient = savedClients.find(c => c.name === clientSelect.value);
        whatsappNumberInput.value = selectedClient ? selectedClient.number : '';
    });

    // --- LÓGICA DAS MENSAGENS (LOCAL) ---
    const messageSelect = document.getElementById('message-select');
    const whatsappMessageInput = document.getElementById('whatsapp-message');
    const generateLinkBtn = document.getElementById('btn-gerar-link');
    const messageTitleInput = document.getElementById('message-title-input');
    const messageTextInput = document.getElementById('message-text-input');
    const addMessageBtn = document.getElementById('btn-add-message');
    const messageList = document.getElementById('message-list');

    const saveMessages = () => localStorage.setItem('scarpim_messages_local', JSON.stringify(savedMessages));
    const renderMessages = () => {
        messageList.innerHTML = '';
        messageSelect.innerHTML = '<option value="">Seleciona uma mensagem</option>';
        savedMessages.forEach((msg, index) => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `<span>${msg.title}</span> <button class="delete-btn" data-index="${index}">X</button>`;
            messageList.appendChild(listItem);

            const optionItem = new Option(msg.title, msg.text);
            messageSelect.appendChild(optionItem);
        });
    };
    addMessageBtn.addEventListener('click', () => {
        const title = messageTitleInput.value.trim();
        const text = messageTextInput.value.trim();
        if (title && text) {
            savedMessages.push({ title, text });
            messageTitleInput.value = '';
            messageTextInput.value = '';
            saveMessages();
            renderMessages();
        } else {
            alert('Preenche o título e o texto da mensagem.');
        }
    });
    messageList.addEventListener('click', e => {
        if (e.target.classList.contains('delete-btn')) {
            const index = e.target.dataset.index;
            if (confirm(`Remover a mensagem "${savedMessages[index].title}"?`)) {
                savedMessages.splice(index, 1);
                saveMessages();
                renderMessages();
            }
        }
    });
    messageSelect.addEventListener('change', () => {
        whatsappMessageInput.value = messageSelect.value;
    });

    generateLinkBtn.addEventListener('click', () => {
        const number = whatsappNumberInput.value.replace(/\D/g, '');
        const message = whatsappMessageInput.value.trim();
        if (number.length < 10) {
            alert('Insere um número de telemóvel válido com indicativo.');
            return;
        }
        window.open(`https://wa.me/55${number}?text=${encodeURIComponent(message)}`, '_blank');
    });

    // --- MÓDULOS FUTUROS (AINDA NÃO MIGRADOS) ---
    // A lógica para Pedidos, Despesas, Metas, etc., permanecerá aqui, mas
    // precisará ser refatorada para usar `fetch` como fizemos com Stock e Clientes.

    // --- INICIALIZAÇÃO DA APP ---
    initializeApp();
});

