import { component$ } from '@builder.io/qwik'
import type { DocumentHead } from '@builder.io/qwik-city'

export default component$(() => {
    return (
        <>
            <h1>Bienvenido</h1>

            <p>
                Un robot (bot) de Whatsapp es un programa que reconoce palabras
                clave en los mensajes que entran, y contesta con respuestas
                pre-programadas, facilitando así el dar información a posibles
                clientes desde tu cuenta de Whatsapp automáticamente.
            </p>
            <p>
                Este bot esta hecho en Javascript y usa NodeJS y es{' '}
                <a href="https://www.redhat.com/es/topics/open-source/what-is-open-source">
                    Open Source
                </a>
                .
            </p>
            <p>
                Está programado de tal forma que se pueden usar varias librerías
                (hasta ahora whatsapp-web.js, twilio y Venom) y se puden agregar
                más.
            </p>
            <p>
                Si se quiere cambiar la librería que se está usando, esto se
                puede hacer con solo cambiar unas lineas en el código.
            </p>

            <table border>
                <thead>
                    <tr>
                        <th>Características</th>
                        <th>Estatus</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Menus y Submenus</td>
                        <td>
                            <g-emoji
                                class="g-emoji"
                                alias="white_check_mark"
                                fallback-src="https://github.githubassets.com/images/icons/emoji/unicode/2705.png"
                            >
                                ✅
                            </g-emoji>
                        </td>
                    </tr>
                    <tr>
                        <td>Dialogflow</td>
                        <td>
                            <g-emoji
                                class="g-emoji"
                                alias="white_check_mark"
                                fallback-src="https://github.githubassets.com/images/icons/emoji/unicode/2705.png"
                            >
                                ✅
                            </g-emoji>
                        </td>
                    </tr>
                    <tr>
                        <td>MySQL</td>
                        <td>
                            <g-emoji
                                class="g-emoji"
                                alias="white_check_mark"
                                fallback-src="https://github.githubassets.com/images/icons/emoji/unicode/2705.png"
                            >
                                ✅
                            </g-emoji>
                        </td>
                    </tr>
                    <tr>
                        <td>JSON File</td>
                        <td>
                            <g-emoji
                                class="g-emoji"
                                alias="white_check_mark"
                                fallback-src="https://github.githubassets.com/images/icons/emoji/unicode/2705.png"
                            >
                                ✅
                            </g-emoji>
                        </td>
                    </tr>
                    <tr>
                        <td>QR Scan (route)</td>
                        <td>
                            <g-emoji
                                class="g-emoji"
                                alias="white_check_mark"
                                fallback-src="https://github.githubassets.com/images/icons/emoji/unicode/2705.png"
                            >
                                ✅
                            </g-emoji>
                        </td>
                    </tr>
                    <tr>
                        <td>Easy deploy heroku</td>
                        <td>
                            <g-emoji
                                class="g-emoji"
                                alias="white_check_mark"
                                fallback-src="https://github.githubassets.com/images/icons/emoji/unicode/2705.png"
                            >
                                ✅
                            </g-emoji>
                        </td>
                    </tr>
                    <tr>
                        <td>Buttons</td>
                        <td>
                            <g-emoji
                                class="g-emoji"
                                alias="white_check_mark"
                                fallback-src="https://github.githubassets.com/images/icons/emoji/unicode/2705.png"
                            >
                                ✅
                            </g-emoji>
                            <g-emoji
                                class="g-emoji"
                                alias="information_source"
                                fallback-src="https://github.githubassets.com/images/icons/emoji/unicode/2139.png"
                            >
                                ℹ️
                            </g-emoji>{' '}
                            (No funciona en multi-device)
                        </td>
                    </tr>
                    <tr>
                        <td>Send Voice Note</td>
                        <td>
                            <g-emoji
                                class="g-emoji"
                                alias="white_check_mark"
                                fallback-src="https://github.githubassets.com/images/icons/emoji/unicode/2705.png"
                            >
                                ✅
                            </g-emoji>
                        </td>
                    </tr>
                    <tr>
                        <td>Add support ubuntu/linux</td>
                        <td>
                            <g-emoji
                                class="g-emoji"
                                alias="white_check_mark"
                                fallback-src="https://github.githubassets.com/images/icons/emoji/unicode/2705.png"
                            >
                                ✅
                            </g-emoji>
                        </td>
                    </tr>
                </tbody>
            </table>

            <h2>Requisitos</h2>
            <ul>
                <li>Node v14 o superior</li>
                <li>
                    VSCode (Editor de codigo){' '}
                    <a
                        href="https://code.visualstudio.com/download"
                        rel="nofollow"
                    >
                        Descargar
                    </a>
                </li>
                <li>
                    MySql (opcional) solo aplica si vas a usar el modo 'mysql'{' '}
                    <a href="https://github.com/leifermendez/bot-whatsapp/blob/main/sql-bot.sql">
                        sql-bot.sql migración
                    </a>
                </li>
                <li>
                    Dialogflow (opcional) solo aplica si vas a usar el modo
                    'dialogflow'
                </li>
            </ul>

            <h2>Instalación</h2>
            <ul>
                <li>
                    Abre VSCode y muevete al directorio en donde quieres
                    instalar el bot.
                </li>
                <li>Ejecuta este comando: npm create bot-whatsapp@latest</li>
                <li>Contesta que SI quieres crear un bot nuevo (Y)</li>
                <li>
                    Selecciona con las flechas (arriba y abajo) la librería que
                    vas usar para el bot, cuando estes sobre la opción que
                    quieres, oprime la barra de espacio y luego la tecla "Enter"
                </li>
                <li>
                    De igual forma selecciona la base de datos que quieres usar.
                </li>
                <li>
                    Cambiate al directorio que se creo dependiendo de la base de
                    datos que hayas seleccionado, si seleccionaste "Memory"
                    sería "cd base-wweb-memory"
                </li>
                <li>
                    Ya estando en el nuevo subdirectorio, ejecuta el comando
                    "npm install" y espera a que se instalen las dependencias.
                </li>
                <li>
                    Una vez que termine la instalación ejecuta el comando "npm
                    start"y espera a que te mande el mensaje de que necesitas
                    escanear el código QR, para esto ve al directorio en el que
                    se instaló y busca el archivo "qr.svg" y abrelo, te debe de
                    mostrar un código QR que tienes que escanear en el Whatsapp
                    que quieres ligar con el bot, para esto ve a tu Whatsapp,
                    haz clic en los tres botones de arriba a la derecha y entra
                    en "Linked devices", y luego en el botón que dice "LINK
                    DEVICE", esto va a abrir la camara para que escanes el
                    código.
                </li>
                <li>
                    Una vez ligado el Whatsapp, vas a ver el mensaje de
                    "Proveedor conectado y listo".
                </li>
                <li>
                    Desde OTRO celular manda un mensaje al número del Whatsapp
                    que acabas de ligar al bot con la palabra "Hola" y LISTO.
                </li>
                <li>Debes de recibir una respuesta automática del bot.</li>
            </ul>
        </>
    )
})

export const head: DocumentHead = {
    title: 'Welcome to Qwik Docs Starter',
}
