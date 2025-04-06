# Navigation Examples

This document provides practical examples of using the navigation engine for various web scraping scenarios.

## Table of Contents

- [Basic Navigation](#basic-navigation)
- [Form Filling and Submission](#form-filling-and-submission)
- [Handling Pagination](#handling-pagination)
- [Conditional Navigation](#conditional-navigation)
- [Extracting Data](#extracting-data)
- [Handling Authentication](#handling-authentication)
- [Handling CAPTCHA](#handling-captcha)
- [Troubleshooting](#troubleshooting)

## Basic Navigation

### Example 1: Simple Page Visit and Data Extraction

```json
{
  "startUrl": "https://example.com/products",
  "steps": [
    {
      "type": "extract",
      "name": "pageTitle",
      "selector": "title",
      "description": "Extract the page title"
    }
  ],
  "options": {
    "timeout": 30000
  }
}
```

### Example 2: Click Navigation

```json
{
  "startUrl": "https://example.com",
  "steps": [
    {
      "type": "click",
      "selector": "a.products-link",
      "description": "Click on the Products link",
      "waitFor": ".product-list"
    },
    {
      "type": "extract",
      "name": "products",
      "selector": ".product-item",
      "multiple": true,
      "fields": {
        "name": ".product-name",
        "price": ".product-price"
      },
      "description": "Extract product information"
    }
  ]
}
```

## Form Filling and Submission

### Example 1: Search Form

```json
{
  "startUrl": "https://example.com/search",
  "steps": [
    {
      "type": "input",
      "selector": "#search-input",
      "value": "{{searchTerm}}",
      "humanInput": true,
      "description": "Enter search term"
    },
    {
      "type": "click",
      "selector": "#search-button",
      "waitFor": ".search-results",
      "description": "Click search button and wait for results"
    },
    {
      "type": "extract",
      "name": "searchResults",
      "selector": ".search-result-item",
      "multiple": true,
      "fields": {
        "title": ".result-title",
        "description": ".result-description",
        "url": "a@href"
      },
      "description": "Extract search results"
    }
  ],
  "variables": {
    "searchTerm": "example search"
  }
}
```

### Example 2: Login Form

```json
{
  "startUrl": "https://example.com/login",
  "steps": [
    {
      "type": "input",
      "selector": "#username",
      "value": "{{username}}",
      "description": "Enter username"
    },
    {
      "type": "input",
      "selector": "#password",
      "value": "{{password}}",
      "description": "Enter password"
    },
    {
      "type": "click",
      "selector": "#login-button",
      "waitFor": ".dashboard",
      "description": "Click login button and wait for dashboard"
    },
    {
      "type": "extract",
      "name": "userInfo",
      "selector": ".user-profile",
      "fields": {
        "name": ".user-name",
        "email": ".user-email",
        "role": ".user-role"
      },
      "description": "Extract user information"
    }
  ],
  "variables": {
    "username": "user@example.com",
    "password": "password123"
  },
  "options": {
    "solveCaptcha": true
  }
}
```

## Handling Pagination

### Example 1: Next Page Button

```json
{
  "startUrl": "https://example.com/products",
  "steps": [
    {
      "type": "paginate",
      "selector": ".pagination .next",
      "maxPages": 5,
      "waitFor": ".product-list",
      "extractSteps": [
        {
          "type": "extract",
          "name": "products",
          "selector": ".product-item",
          "multiple": true,
          "fields": {
            "name": ".product-name",
            "price": ".product-price",
            "description": ".product-description"
          }
        }
      ],
      "description": "Extract products from multiple pages"
    }
  ]
}
```

### Example 2: URL-based Pagination

```json
{
  "startUrl": "https://example.com/products?page=1",
  "steps": [
    {
      "type": "extract",
      "name": "products",
      "selector": ".product-item",
      "multiple": true,
      "fields": {
        "name": ".product-name",
        "price": ".product-price"
      },
      "description": "Extract products from page 1"
    },
    {
      "type": "goto",
      "value": "https://example.com/products?page=2",
      "waitFor": ".product-list",
      "description": "Go to page 2"
    },
    {
      "type": "extract",
      "name": "moreProducts",
      "selector": ".product-item",
      "multiple": true,
      "fields": {
        "name": ".product-name",
        "price": ".product-price"
      },
      "description": "Extract products from page 2"
    }
  ]
}
```

## Conditional Navigation

### Example: Handling Different Page Layouts

```json
{
  "startUrl": "https://example.com/product/123",
  "steps": [
    {
      "type": "condition",
      "condition": ".new-layout",
      "description": "Check if the page uses the new layout",
      "thenSteps": [
        {
          "type": "extract",
          "name": "productInfo",
          "selector": ".new-product-container",
          "fields": {
            "name": ".product-name",
            "price": ".product-price",
            "description": ".product-description"
          },
          "description": "Extract product info from new layout"
        }
      ],
      "elseSteps": [
        {
          "type": "extract",
          "name": "productInfo",
          "selector": ".old-product-container",
          "fields": {
            "name": "h1",
            "price": ".price",
            "description": ".description"
          },
          "description": "Extract product info from old layout"
        }
      ]
    }
  ]
}
```

## Extracting Data

### Example 1: Extracting Structured Data

```json
{
  "startUrl": "https://example.com/product/123",
  "steps": [
    {
      "type": "extract",
      "name": "productDetails",
      "selector": ".product-container",
      "fields": {
        "name": {
          "selector": "h1.product-name",
          "type": "css"
        },
        "price": {
          "selector": ".product-price",
          "type": "css",
          "attribute": "textContent",
          "transform": "value => parseFloat(value.replace('$', ''))"
        },
        "description": {
          "selector": ".product-description",
          "type": "css"
        },
        "images": {
          "selector": ".product-image",
          "type": "css",
          "attribute": "src",
          "multiple": true
        },
        "specifications": {
          "selector": ".product-specs tr",
          "type": "css",
          "multiple": true,
          "fields": {
            "name": "td:first-child",
            "value": "td:last-child"
          }
        }
      },
      "description": "Extract detailed product information"
    }
  ]
}
```

### Example 2: Extracting Data with Different Selector Types

```json
{
  "startUrl": "https://example.com/product/123",
  "steps": [
    {
      "type": "extract",
      "name": "productData",
      "fields": {
        "name": {
          "type": "css",
          "selector": "h1.product-name"
        },
        "description": {
          "type": "xpath",
          "selector": "//div[@class='description']"
        },
        "sku": {
          "type": "regex",
          "pattern": "SKU: ([A-Z0-9]+)",
          "source": ".product-details"
        },
        "jsonData": {
          "type": "function",
          "function": "async (page) => { return await page.evaluate(() => { return JSON.parse(document.querySelector('script#product-data').textContent); }); }"
        }
      },
      "description": "Extract product data using different selector types"
    }
  ]
}
```

## Handling Authentication

### Example: Login and Extract Protected Data

```json
{
  "startUrl": "https://example.com/login",
  "steps": [
    {
      "type": "input",
      "selector": "#email",
      "value": "{{email}}",
      "description": "Enter email address"
    },
    {
      "type": "input",
      "selector": "#password",
      "value": "{{password}}",
      "description": "Enter password"
    },
    {
      "type": "click",
      "selector": "#login-button",
      "waitFor": ".dashboard",
      "description": "Click login button and wait for dashboard"
    },
    {
      "type": "goto",
      "value": "https://example.com/account/orders",
      "waitFor": ".order-history",
      "description": "Navigate to order history page"
    },
    {
      "type": "extract",
      "name": "orders",
      "selector": ".order-item",
      "multiple": true,
      "fields": {
        "orderNumber": ".order-number",
        "date": ".order-date",
        "total": ".order-total",
        "status": ".order-status"
      },
      "description": "Extract order history"
    }
  ],
  "variables": {
    "email": "user@example.com",
    "password": "password123"
  }
}
```

## Handling CAPTCHA

### Example: Solving CAPTCHA During Login

```json
{
  "startUrl": "https://example.com/login",
  "steps": [
    {
      "type": "input",
      "selector": "#username",
      "value": "{{username}}",
      "description": "Enter username"
    },
    {
      "type": "input",
      "selector": "#password",
      "value": "{{password}}",
      "description": "Enter password"
    },
    {
      "type": "click",
      "selector": "#login-button",
      "description": "Click login button"
    },
    {
      "type": "wait",
      "value": ".dashboard, .captcha-container",
      "description": "Wait for either dashboard or CAPTCHA"
    },
    {
      "type": "condition",
      "condition": ".captcha-container",
      "description": "Check if CAPTCHA appeared",
      "thenSteps": [
        {
          "type": "wait",
          "value": 5000,
          "description": "Wait for CAPTCHA to be solved automatically"
        }
      ]
    },
    {
      "type": "extract",
      "name": "accountInfo",
      "selector": ".account-info",
      "fields": {
        "name": ".user-name",
        "email": ".user-email",
        "memberSince": ".member-since"
      },
      "description": "Extract account information"
    }
  ],
  "variables": {
    "username": "user@example.com",
    "password": "password123"
  },
  "options": {
    "solveCaptcha": true
  }
}
```

## Troubleshooting

### Example 1: Extracting Arabic Content

This example demonstrates how to extract content in Arabic from a gold price website:

```json
{
  "startUrl": "https://www.gold-price-today.com/",
  "steps": [
    {
      "type": "click",
      "selector": ".fc-button.fc-cta-consent.fc-primary-button",
      "description": "Click the consent button to dismiss the cookie dialog",
      "waitFor": "#calculator",
      "timeout": 5000
    },
    {
      "type": "wait",
      "value": 2000,
      "description": "Wait a bit for dynamic content to load"
    },
    {
      "type": "extract",
      "name": "goldPriceFactors",
      "selector": "#calculator",
      "fields": {
        "title": {
          "selector": "h2",
          "type": "css"
        },
        "content": {
          "selector": "span",
          "type": "css"
        }
      },
      "description": "Extract the information about gold price factors"
    }
  ],
  "options": {
    "timeout": 30000,
    "waitForSelector": "#calculator",
    "solveCaptcha": false,
    "javascript": true
  }
}
```

The HTML structure being extracted:

```html
<div id="calculator">
  <h2>عوامل ارتفاع سعر الذهب اليوم</h2>
  <span
    ><br />
    يتوقف ارتفاع <b>اسعار الذهب اليوم</b> او انخفاضها علي عاملين اساسيين , سعر برميل النفط وسعر
    الدولار , فكلما ارتفع سعر برميل النفط ارتفعت معه اسعار الذهب وكلما انخفض سعر الدولار الامريكي
    كلما زادت <b>اسعار الذهب</b> , وعلي الجانب الاخر التغيرات في الحياة السياسية كالحرب علي العراق
    ثم حرب لبنان يؤدي الي انخفاض سعر الدولار وبدوره يؤدي الي ارتفاع سعر الذهب. <br /><a
      href="https://egypt.gold-price-today.com/"
      >اسعار الذهب فى مصر</a
    >
  </span>
</div>
```

Response:

```bash
{
    "success": true,
    "message": "Navigation flow executed successfully",
    "data": {
        "id": "nav_1743935210045",
        "startUrl": "https://www.gold-price-today.com/",
        "status": "completed",
        "stepsExecuted": 3,
        "result": {
            "goldPriceFactors": {
                "title": "عوامل ارتفاع سعر الذهب اليوم",
                "content": "يتوقف ارتفاع اسعار الذهب اليوم او انخفاضها علي عاملين اساسيين , سعر برميل النفط وسعر الدولار , فكلما ارتفع سعر برميل النفط ارتفعت معه اسعار الذهب وكلما انخفض سعر الدولار الامريكي كلما زادت اسعار الذهب , وعلي الجانب الاخر التغيرات في الحياة السياسية كالحرب علي العراق ثم حرب لبنان يؤدي الي انخفاض سعر الدولار وبدوره يؤدي الي ارتفاع سعر الذهب.\nاسعار الذهب فى مصر"
            }
        },
        "timestamp": "2025-04-06T10:26:50.045Z"
    },
    "timestamp": "2025-04-06T10:26:50.045Z"
}
```

### Example 2:

```json
{
  "startUrl": "https://egypt.gold-price-today.com/",
  "steps": [
    {
      "type": "wait",
      "value": 2000,
      "description": "Wait for dynamic content to load"
    },
    {
      "type": "condition",
      "condition": ".fc-button.fc-cta-consent.fc-primary-button",
      "description": "Check if consent dialog appears",
      "thenSteps": [
        {
          "type": "click",
          "selector": ".fc-button.fc-cta-consent.fc-primary-button",
          "description": "Click the consent button to dismiss the cookie dialog",
          "waitFor": 2000
        }
      ]
    },
    {
      "type": "extract",
      "name": "pageInfo",
      "selector": "#right h2",
      "description": "Extract the page title"
    },
    {
      "type": "extract",
      "name": "pageDescription",
      "selector": "#right p.text",
      "description": "Extract the page description"
    },
    {
      "type": "extract",
      "name": "currentGoldPrices",
      "selector": "table.prices-table:first-of-type",
      "fields": {
        "title": {
          "selector": "caption",
          "type": "css"
        },
        "prices": {
          "selector": "tbody tr",
          "type": "css",
          "multiple": true,
          "fields": {
            "type": {
              "selector": "th",
              "type": "css"
            },
            "sellPrice": {
              "selector": "td:nth-child(2)",
              "type": "css"
            },
            "buyPrice": {
              "selector": "td:nth-child(3)",
              "type": "css"
            }
          }
        },
        "dollarPrice": {
          "selector": "tbody tr:last-child td",
          "type": "css"
        },
        "lastUpdated": {
          "selector": "tfoot tr td",
          "type": "css"
        }
      },
      "description": "Extract current gold prices table"
    },
    {
      "type": "extract",
      "name": "historicalPrices",
      "selector": "table.prices-table:nth-of-type(2)",
      "fields": {
        "title": {
          "selector": "caption",
          "type": "css"
        },
        "history": {
          "selector": "tbody tr",
          "type": "css",
          "multiple": true,
          "fields": {
            "date": {
              "selector": "th",
              "type": "css"
            },
            "carat24": {
              "selector": "td:nth-child(2)",
              "type": "css"
            },
            "carat22": {
              "selector": "td:nth-child(3)",
              "type": "css"
            },
            "carat21": {
              "selector": "td:nth-child(4)",
              "type": "css"
            },
            "carat18": {
              "selector": "td:nth-child(5)",
              "type": "css"
            },
            "ounce": {
              "selector": "td:nth-child(6)",
              "type": "css"
            },
            "trend": {
              "selector": "td:nth-child(7)",
              "type": "css"
            }
          }
        }
      },
      "description": "Extract historical gold prices table"
    },
    {
      "type": "extract",
      "name": "additionalInfo",
      "selector": "#right p:last-of-type",
      "description": "Extract additional information about gold prices"
    }
  ],
  "options": {
    "timeout": 30000,
    "waitForSelector": "table.prices-table",
    "solveCaptcha": false,
    "javascript": true
  }
}
```

Result:

```bash
{
    "success": true,
    "message": "Navigation flow executed successfully",
    "data": {
        "id": "nav_1743937221168",
        "startUrl": "https://egypt.gold-price-today.com/",
        "status": "completed",
        "stepsExecuted": 7,
        "result": {
            "pageInfo": "سعر الذهب اليوم في مصر",
            "pageDescription": "تحتوي الصفحة علي تقرير دوري ومتجدد بأسعار معدن الذهب اليوم في مصر بالعملة الوطنية الجنيه المصري وأيضا الدولار الأمريكي.\n\nيشمل التقرير أسعار المعدن بجميع عياراته (عيار 24, 22, 18, 14, 12) في مصر.\n\nوتحتوي أيضا علي مخطط بمعدل الارتفاع والانخفاض في اسعار الذهب اليوم في مصر في الأيام السابقة في السوق المصري.\n\nحيث يتم متابعة أسعار الذهب اليوم في مصر على مدار الساعة وبشكل دوري وذلك حسب توقيت القاهرة.",
            "currentGoldPrices": {
                "title": "متوسط اسعار الذهب اليوم بمحلات الصاغة في مصر بدون مصنعية",
                "prices": "عيار 24\n                5011 جنيه\n                                    4977 جنيه",
                "dollarPrice": "3037.76 دولار",
                "lastUpdated": "تم تحديث أسعار الذهب في مصر في الأحد, 6 إبريل, 01:00 مساءًا"
            },
            "historicalPrices": {
                "title": "متوسط سعر بيع الذهب في الأيام السابقة في مصر بالجنيه المصري",
                "history": "السبت، 5 إبريل\n\t\t4977\n\t\t4562\n\t\t4355\n\t\t3733\n\t\t154807\n\t\t⬇️"
            },
            "additionalInfo": "اسعار الذهب في مصر"
        },
        "timestamp": "2025-04-06T11:00:21.168Z"
    },
    "timestamp": "2025-04-06T11:00:21.169Z"
}
```

### Example 3: Using Function Selector for Complex Extraction

When standard selectors aren't working, you can use a custom function in your extraction step. Note that the function needs to be executed in the page context.

**Important**: When using functions in JSON, you must ensure all newlines and control characters are properly escaped. For HTTP requests, it's best to convert the function to a single line:

```json
{
  "startUrl": "https://www.gold-price-today.com/",
  "steps": [
    {
      "type": "click",
      "selector": ".fc-button.fc-cta-consent.fc-primary-button",
      "description": "Click the consent button to dismiss the cookie dialog",
      "waitFor": "#calculator",
      "timeout": 5000
    },
    {
      "type": "extract",
      "name": "goldPriceFactors",
      "selector": "#calculator",
      "fields": {
        "customExtraction": {
          "type": "function",
          "function": "async (page) => { return await page.evaluate(() => { const calculator = document.querySelector('#calculator'); if (!calculator) return null; const title = calculator.querySelector('h2')?.textContent || ''; const content = calculator.querySelector('span')?.innerHTML || ''; return { title, content }; }); }"
        }
      },
      "description": "Extract gold price factors using a custom function"
    }
  ],
  "options": {
    "timeout": 30000,
    "javascript": true
  }
}
```

For readability in your code, you can format the function with proper indentation, but when sending it as JSON, convert it to a single line to avoid parsing errors:

```javascript
// Original function with formatting
const functionWithFormatting = `async (page) => { 
  return await page.evaluate(() => {
    const calculator = document.querySelector('#calculator');
    if (!calculator) return null;
    
    const title = calculator.querySelector('h2')?.textContent || '';
    const content = calculator.querySelector('span')?.innerHTML || '';
    
    return { title, content };
  });
}`;

// Convert to single line for JSON
const functionForJson = functionWithFormatting.replace(/\s+/g, ' ');
```

Alternatively, you can use a simpler approach with standard selectors:

```json
{
  "startUrl": "https://www.gold-price-today.com/",
  "steps": [
    {
      "type": "click",
      "selector": ".fc-button.fc-cta-consent.fc-primary-button",
      "description": "Click the consent button to dismiss the cookie dialog",
      "waitFor": "#calculator",
      "timeout": 5000
    },
    {
      "type": "extract",
      "name": "goldPriceFactors",
      "selector": "#calculator",
      "fields": {
        "title": {
          "selector": "h2",
          "type": "css"
        },
        "content": {
          "selector": "span",
          "type": "css",
          "attribute": "innerHTML"
        }
      },
      "description": "Extract gold price factors using standard selectors"
    }
  ],
  "options": {
    "timeout": 30000,
    "javascript": true
  }
}
```

### Example 3: Extracting Raw HTML

Sometimes it's easier to extract the raw HTML and process it separately:

```json
{
  "startUrl": "https://www.gold-price-today.com/",
  "steps": [
    {
      "type": "click",
      "selector": ".fc-button.fc-cta-consent.fc-primary-button",
      "description": "Click the consent button to dismiss the cookie dialog",
      "waitFor": "#calculator",
      "timeout": 5000
    },
    {
      "type": "extract",
      "name": "rawHtml",
      "selector": "#calculator",
      "attribute": "outerHTML",
      "description": "Extract the raw HTML of the calculator section"
    }
  ],
  "options": {
    "timeout": 30000,
    "javascript": true
  }
}
```
