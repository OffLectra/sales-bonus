// Функция расчета выручки для одного товара
function calculateSimpleRevenue(purchase, _product) {
    const { discount, sale_price, quantity } = purchase;
    const discountMultiplier = 1 - (discount / 100);
    const revenue = sale_price * quantity * discountMultiplier;
    return revenue;
}

// Функция расчета бонуса на основе позиции в рейтинге
function calculateBonusByProfit(index, total, seller) {
    const { profit } = seller;
    const position = index + 1;

    if (position === 1) {
        return profit * 0.15;
    } else if (position === 2 || position === 3) {
        return profit * 0.10;
    } else if (position === total) {
        return 0;
    } else {
        return profit * 0.05;
    }
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

    // Обработка чеков - ИСПОЛЬЗУЕМ ГОТОВЫЕ ПОЛЯ ИЗ ЧЕКОВ
    data.purchase_records.forEach(record => {
        const seller = sellerIndex[record.seller_id];
        if (!seller) return;

        seller.sales_count += 1;
        
        // ВЫРУЧКА: используем готовое поле total_amount МИНУС total_discount
        seller.revenue += record.total_amount - record.total_discount;

        // Для прибыли и топа товаров все равно обрабатываем каждый товар
        record.items.forEach(item => {
            const product = productIndex[item.sku];
            if (!product) return;

            // Расчет себестоимости товара
            const cost = product.purchase_price * item.quantity;
            
            // Расчет выручки для этого товара (только для прибыли)
            const revenue = calculateRevenue(item, product);
            
            // Прибыль = выручка - себестоимость
            const profit = revenue - cost;
            
            seller.profit += profit;

            // Учет проданных товаров для топа
            if (!seller.products_sold[item.sku]) {
                seller.products_sold[item.sku] = 0;
            }
            seller.products_sold[item.sku] += item.quantity;
        });
    });

    // Сортировка продавцов по прибыли (убывание)
    sellerStats.sort((sellerA, sellerB) => sellerB.profit - sellerA.profit);

    // Расчет бонусов и формирование топа товаров
    sellerStats.forEach((seller, index) => {
        seller.bonus = calculateBonus(index, sellerStats.length, seller);
        
        seller.top_products = Object.entries(seller.products_sold)
            .map(([sku, quantity]) => ({ sku, quantity }))
            .sort((productA, productB) => productB.quantity - productA.quantity)
            .slice(0, 10);
    });

    // Финальное округление через toFixed(2)
    return sellerStats.map(seller => ({
        seller_id: seller.id,
        name: seller.name,
        revenue: +(seller.revenue.toFixed(2)),
        profit: +(seller.profit.toFixed(2)),
        sales_count: seller.sales_count,
        top_products: seller.top_products,
        bonus: +(seller.bonus.toFixed(2))
    }));
}