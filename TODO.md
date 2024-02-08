- [x] EVENTS.WELCOME no lo completa
- [x] verificar todos "sendMessage" sendMessage = async (numberIn: string | number, message: string, { options }: { options: SendOptions }):
- [ ] todos los provider necesitan tener initHttpServer ya se default o no si es grauitos
- [ ] todos los providers envien la propiedad "name"
- [ ] revisar los packages de context dialogflows
- [ ] cambiar contexto de sendMessage en los providers
- [ ] todos los providers deben tener "globalVendorArgs"
- [ ] hacer que los addKeyowrd([]) ni ('')
- [ ] terminar wrapper `database`
- [ ] terminar wrapper `provider`
- [ ] cambiar los startes
- [ ] asegurar el covergage 90%
- [x] state.get<generico> o 
- [ ] https://github.com/codigoencasa/bot-whatsapp/pull/977#issuecomment-1920056490
- [ ] mirar este PR https://github.com/codigoencasa/bot-whatsapp/pull/965/files
- [ ] revisar test.skip
- [ ] cambiar el CONTRIBUTING.md
- [ ] eslinter nueva regla flowDynamic seguido de un endFLow  no sirve el endFlow entonces la idae esuqe diga que no puede usar juntoss

    initHttpServer(port: number) {
        const methods: BotCtxMiddleware = {
            sendMessage: this.sendMessage,
            provider: this.vendor,
        }
        this.http.start(methods, port)
    }