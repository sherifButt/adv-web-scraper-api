# Regex Extraction Guide

The Advanced Web Scraper API provides robust regex extraction capabilities for extracting structured data from HTML content.

## Basic Usage

Regex selectors can be used in two ways:

1. **Direct regex pattern**:
```json
{
  "selector": "/£([0-9,]+)/",
  "type": "regex"
}
```

2. **Regex pattern applied to CSS/XPath extracted content**:
```json
{
  "selector": "address.propertyCard-address",
  "type": "regex", 
  "pattern": "/\\b([A-Z]{1,2}\\d[A-Z\\d]?\\s\\d[A-Z]{2})\\b/"
}
```

## Configuration Options

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `selector` | string | Regex pattern (with slashes) or CSS/XPath selector | `"/£([0-9,]+)/"` |
| `type` | string | Must be `"regex"` | `"regex"` |
| `pattern` | string | Alternative to `selector` - regex pattern without slashes | `"\\b([A-Z]{1,2}\\d[A-Z\\d]?\\s\\d[A-Z]{2})\\b"` |
| `flags` | string | Regex flags (g, i, m, s) | `"gi"` |
| `group` | number | Capture group to extract (0 = full match) | `1` |
| `source` | string | Source content: `"html"`, `"text"` or CSS/XPath selector | `"html"` |
| `multiple` | boolean | Return all matches (array) or first match | `true` |

## Examples

### Extracting Prices

```json
{
  "price": {
    "selector": "/£([0-9,]+)/",
    "type": "regex",
    "dataType": "number",
    "transform": "value.replace(/,/g, '')"
  }
}
```

### Extracting Postcodes

```json
{
  "postcode": {
    "selector": "address.propertyCard-address",
    "type": "regex",
    "pattern": "/\\b([A-Z]{1,2}\\d[A-Z\\d]?\\s\\d[A-Z]{2})\\b/",
    "multiple": true
  }
}
```

### Extracting URLs

```json
{
  "url": {
    "selector": "/https?:\\/\\/[\\w.-]+\\.[a-z]{2,}\\/[^\\s\"]+/gi",
    "type": "regex",
    "multiple": true
  }
}
```

### Extracting Phone Numbers

```json
{
  "phone": {
    "selector": "/(?:\\+44|0)\\s?\\d{2,4}\\s?\\d{3,4}\\s?\\d{3,4}/",
    "type": "regex",
    "multiple": true
  }
}
``` 

### Extracting Numbers from text extracted from a CSS selector

```json
{
  "number": {
    "selector": ".content",
    "type": "regex",
    "pattern": "/\\d+/",
    "multiple": true
  }
}
```


## Best Practices

1. **Use specific patterns** - Narrow regex patterns reduce false matches
2. **Prefer capture groups** - Extract just the data you need
3. **Combine with CSS/XPath** - First narrow down with selectors
4. **Test patterns** - Validate patterns against sample content
5. **Handle edge cases** - Account for optional elements/spacing

## Pattern Examples

| Description | Pattern |
|-------------|---------|
| UK Postcode | `/\b([A-Z]{1,2}\d[A-Z\d]?\s\d[A-Z]{2})\b/` |
| UK Phone | `/(?:\+44|0)\s?\d{2,4}\s?\d{3,4}\s?\d{3,4}/` |
| Email | `/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/` |
| Price | `/£([\d,]+\.\d{2})/` |
| Date (DD/MM/YYYY) | `/\b(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[012])\/(19|20)\d{2}\b/` |
| URL | `/https?:\/\/[^\s]+/` |
| Number | `/[\d,]+/` |
| Text between tags | `/<tag>(.*?)<\/tag>/` |
| IP Address | `/\b(?:\d{1,3}\.){3}\d{1,3}\b/` |

## Performance Considerations

1. Complex regex patterns can impact performance
2. Avoid greedy quantifiers (`.*`) when possible
3. Use atomic groups for better performance
4. Consider using CSS/XPath first to narrow content

For more examples, see the [Rightmove config example](../rightmove-config.json).
