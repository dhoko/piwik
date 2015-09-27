function logEcommerce(orderId, grandTotal, subTotal, tax, shipping, discount) {
  var request = 'idgoal=0',
      lastEcommerceOrderTs,
      now = new Date(),
      items = [],
      sku;

  if (String(orderId).length) {
    request += '&ec_id=' + encodeWrapper(orderId);
    // Record date of order in the visitor cookie
    lastEcommerceOrderTs = Math.round(now.getTime() / 1000);
  }

  request += '&revenue=' + grandTotal;

  if (String(subTotal).length) {
    request += '&ec_st=' + subTotal;
  }

  if (String(tax).length) {
    request += '&ec_tx=' + tax;
  }

  if (String(shipping).length) {
    request += '&ec_sh=' + shipping;
  }

  if (String(discount).length) {
    request += '&ec_dt=' + discount;
  }

  if (ecommerceItems) {
    // Removing the SKU index in the array before JSON encoding
    for (sku in ecommerceItems) {

      if (Object.prototype.hasOwnProperty.call(ecommerceItems, sku)) {
        // Ensure name and category default to healthy value
        if (!isDefined(ecommerceItems[sku][1])) {
            ecommerceItems[sku][1] = "";
        }

        if (!isDefined(ecommerceItems[sku][2])) {
            ecommerceItems[sku][2] = "";
        }

        // Set price to zero
        if (!isDefined(ecommerceItems[sku][3])
                || String(ecommerceItems[sku][3]).length === 0) {
            ecommerceItems[sku][3] = 0;
        }

        // Set quantity to 1
        if (!isDefined(ecommerceItems[sku][4])
                || String(ecommerceItems[sku][4]).length === 0) {
            ecommerceItems[sku][4] = 1;
        }

        items.push(ecommerceItems[sku]);
      }
    }

    request += '&ec_items=' + encodeWrapper(JSON2.stringify(items));
  }
  request = getRequest(request, configCustomData, 'ecommerce', lastEcommerceOrderTs);
  sendRequest(request, configTrackerPause);
}

function logEcommerceOrder(orderId, grandTotal, subTotal, tax, shipping, discount) {
  if (String(orderId).length && isDefined(grandTotal)) {
    logEcommerce(orderId, grandTotal, subTotal, tax, shipping, discount);
  }
}

function logEcommerceCartUpdate(grandTotal) {
  if (isDefined(grandTotal)) {
    logEcommerce("", grandTotal, "", "", "", "");
  }
}


/**
 * Used to record that the current page view is an item (product) page view, or a Ecommerce Category page view.
 * This must be called before trackPageView() on the product/category page.
 * It will set 3 custom variables of scope "page" with the SKU, Name and Category for this page view.
 * Note: Custom Variables of scope "page" slots 3, 4 and 5 will be used.
 *
 * On a category page, you can set the parameter category, and set the other parameters to empty string or false
 *
 * Tracking Product/Category page views will allow Piwik to report on Product & Categories
 * conversion rates (Conversion rate = Ecommerce orders containing this product or category / Visits to the product or category)
 *
 * @param string sku Item's SKU code being viewed
 * @param string name Item's Name being viewed
 * @param string category Category page being viewed. On an Item's page, this is the item's category
 * @param float price Item's display price, not use in standard Piwik reports, but output in API product reports.
 */
function setEcommerceView(sku, name, category, price) {
  if (!isDefined(category) || !category.length) {
    category = "";
  } else if (category instanceof Array) {
    category = JSON2.stringify(category);
  }

  customVariablesPage[5] = ['_pkc', category];

  if (isDefined(price) && String(price).length) {
    customVariablesPage[2] = ['_pkp', price];
  }

  // On a category page, do not track Product name not defined
  if ((!isDefined(sku) || !sku.length) && (!isDefined(name) || !name.length)) {
    return;
  }

  if (isDefined(sku) && sku.length) {
    customVariablesPage[3] = ['_pks', sku];
  }

  if (!isDefined(name) || !name.length) {
    name = "";
  }

  customVariablesPage[4] = ['_pkn', name];
},

/**
 * Adds an item (product) that is in the current Cart or in the Ecommerce order.
 * This function is called for every item (product) in the Cart or the Order.
 * The only required parameter is sku.
 *
 * @param string sku (required) Item's SKU Code. This is the unique identifier for the product.
 * @param string name (optional) Item's name
 * @param string name (optional) Item's category, or array of up to 5 categories
 * @param float price (optional) Item's price. If not specified, will default to 0
 * @param float quantity (optional) Item's quantity. If not specified, will default to 1
 */
function addEcommerceItem(sku, name, category, price, quantity) {
  if (sku.length) {
    ecommerceItems[sku] = [ sku, name, category, price, quantity ];
  }
},

/**
 * Tracks an Ecommerce order.
 * If the Ecommerce order contains items (products), you must call first the addEcommerceItem() for each item in the order.
 * All revenues (grandTotal, subTotal, tax, shipping, discount) will be individually summed and reported in Piwik reports.
 * Parameters orderId and grandTotal are required. For others, you can set to false if you don't need to specify them.
 *
 * @param string|int orderId (required) Unique Order ID.
 *                   This will be used to count this order only once in the event the order page is reloaded several times.
 *                   orderId must be unique for each transaction, even on different days, or the transaction will not be recorded by Piwik.
 * @param float grandTotal (required) Grand Total revenue of the transaction (including tax, shipping, etc.)
 * @param float subTotal (optional) Sub total amount, typically the sum of items prices for all items in this order (before Tax and Shipping costs are applied)
 * @param float tax (optional) Tax amount for this order
 * @param float shipping (optional) Shipping amount for this order
 * @param float discount (optional) Discounted amount in this order
 */
function trackEcommerceOrder(orderId, grandTotal, subTotal, tax, shipping, discount) {
    logEcommerceOrder(orderId, grandTotal, subTotal, tax, shipping, discount);
},

/**
 * Tracks a Cart Update (add item, remove item, update item).
 * On every Cart update, you must call addEcommerceItem() for each item (product) in the cart, including the items that haven't been updated since the last cart update.
 * Then you can call this function with the Cart grandTotal (typically the sum of all items' prices)
 *
 * @param float grandTotal (required) Items (products) amount in the Cart
 */
function trackEcommerceCartUpdate(grandTotal) {
    logEcommerceCartUpdate(grandTotal);
}

module.exports = {
  setEcommerceView: setEcommerceView,
  addEcommerceItem: addEcommerceItem,
  trackEcommerceOrder: trackEcommerceOrder,
  trackEcommerceCartUpdate: trackEcommerceCartUpdate,
};
