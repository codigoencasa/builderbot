const notFounds = [
    [
        '/',
        '<!DOCTYPE html>\n<html>\n    <head>\n        <meta charset="utf-8" />\n        <meta http-equiv="Status" content="404" />\n        <title>404 Resource Not Found</title>\n        <meta name="viewport" content="width=device-width,initial-scale=1" />\n        <style>\n            body {\n                color: #006ce9;\n                background-color: #fafafa;\n                padding: 30px;\n                font-family: ui-sans-serif, system-ui, -apple-system,\n                    BlinkMacSystemFont, Roboto, sans-serif;\n            }\n            p {\n                max-width: 600px;\n                margin: 60px auto 30px auto;\n                background: white;\n                border-radius: 4px;\n                box-shadow: 0px 0px 50px -20px #006ce9;\n                overflow: hidden;\n            }\n            strong {\n                display: inline-block;\n                padding: 15px;\n                background: #006ce9;\n                color: white;\n            }\n            span {\n                display: inline-block;\n                padding: 15px;\n            }\n            pre {\n                max-width: 580px;\n                margin: 0 auto;\n            }\n        </style>\n    </head>\n    <body>\n        <p><strong>404</strong> <span>Resource Not Found</span></p>\n    </body>\n</html>\n',
    ],
]
function getNotFound(p) {
    for (const r of notFounds) {
        if (p.startsWith(r[0])) {
            return r[1]
        }
    }
    return 'Resource Not Found'
}
export { getNotFound }
