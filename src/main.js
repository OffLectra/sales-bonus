// Функция расчета выручки для одного товара
function calculateSimpleRevenue(purchase, _product) {
    const { discount, sale_price, quantity } = purchase;
    
    // Точный расчет через умножение на 100 (избегаем float ошибок)
    const totalCents = sale_price * quantity * 100;
    const discountAmount = totalCents * discount / 100;
    const revenueCents = totalCents - discountAmount;
    
    // Округление до целых копеек и преобразование обратно
    return Math.round(revenueCents) / 100;
}

// Функция расчета бонуса на основе позиции в рейтинге
function calculateBonusByProfit(index, total, seller) {
    const { profit } = seller;
    const position = index + 1;

    // Работа с profit как есть (уже округленным в analyzeSalesData)
    let bonus;
    if (position === 1) {
        bonus = profit * 0.15;
    } else if (position === 2 || position === 3) {
        bonus = profit * 0.10;
    } else if (position === total) {
        bonus = 0;
    } else {
        bonus = profit * 0.05;
    }
    
    return Math.round(bonus * 100) / 100;
}

// Главная функция анализа данных о продажах
function analyzeSalesData(data, options) {
    // Проверка входных данных
    if (!data
        || !Array.isArray(data.sellers) || data.sellers.length === 0
        || !Array.isArray(data.products) || data.products.length === 0
        || !Array.isArray(data.purchase_records) || data.purchase_records.length === 0
    ) {
        throw new Error('Некорректные входные данные: отсутствуют или пусты необходимые коллекции');
    }

    // Проверка опций
    if (!options || typeof options !== "object") {
        throw new Error('Опции не переданы или переданы в некорректном формате');
    }

    const { calculateRevenue, calculateBonus } = options;

    if (!calculateRevenue || !calculateBonus) {
        throw new Error('В опциях отсутствуют необходимые функции для расчетов');
    }

    if (typeof calculateRevenue !== "function" || typeof calculateBonus !== "function") {
        throw new Error('Переданные опции не являются функциями');
    }

    // Подготовка промежуточных данных
    const sellerStats = data.sellers.map(seller => ({
        id: seller.id,
        name: `${seller.first_name} ${seller.last_name}`,
        revenue: 0,
        profit: 0,
        sales_count: 0,
        products_sold: {}
    }));

    // Создание индексов для быстрого доступа
    const sellerIndex = sellerStats.reduce((result, sellerStat) => {
        result[sellerStat.id] = sellerStat;
        return result;
    }, {});

    const productIndex = data.products.reduce((result, product) => {
        result[product.sku] = product;
        return result;
    }, {});

    // Обработка чеков - ОКРУГЛЕНИЕ КАЖДОГО ТОВАРА
    data.purchase_records.forEach(record => {
        const seller = sellerIndex[record.seller_id];
        if (!seller) return;

        seller.sales_count += 1;

        record.items.forEach(item => {
            const product = productIndex[item.sku];
            if (!product) return;

            // Расчет выручки для товара (уже округленная в calculateSimpleRevenue)
            const itemRevenue = calculateRevenue(item, product);
            
            // Расчет себестоимости с округлением
            const itemCost = Math.round(product.purchase_price * item.quantity * 100) / 100;
            
            // Расчет прибыли для товара с округлением
            const itemProfit = Math.round((itemRevenue - itemCost) * 100) / 100;

            // Накопление с округлением на каждом шаге
            seller.revenue = Math.round((seller.revenue + itemRevenue) * 100) / 100;
            seller.profit = Math.round((seller.profit + itemProfit) * 100) / 100;

            if (!seller.products_sold[item.sku]) {
                seller.products_sold[item.sku] = 0;
            }
            seller.products_sold[item.sku] += item.quantity;
        });
    });

    // Сортировка продавцов по прибыли (убывание)
    sellerStats.sort((sellerA, sellerB) => sellerB.profit - sellerA.profit);

    // Расчет бонусов - передаем УЖЕ ОКРУГЛЕННУЮ прибыль
    sellerStats.forEach((seller, index) => {
        // Прибыль уже округлена в цикле выше
        seller.bonus = calculateBonus(index, sellerStats.length, seller);
        
        seller.top_products = Object.entries(seller.products_sold)
            .map(([sku, quantity]) => ({ sku, quantity }))
            .sort((productA, productB) => productB.quantity - productA.quantity)
            .slice(0, 10);
    });

    // Финальное округление (хотя все уже округлено)
    return sellerStats.map(seller => ({
        seller_id: seller.id,
        name: seller.name,
        revenue: seller.revenue, // Уже округлено
        profit: seller.profit,   // Уже округлено
        sales_count: seller.sales_count,
        top_products: seller.top_products,
        bonus: seller.bonus      // Уже округлено в calculateBonusByProfit
    }));
}