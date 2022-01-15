const middlewareClient = (client = null) => async (req, res, next) => {
    try {

        if(!client){
            res.status(409)
            console.log(client)
            res.send({ error: 'Error de client.' }) 
        }else{
            req.clientWs = client;
            next()
        }
       

    } catch (e) {
        console.log(e)
        res.status(409)
        res.send({ error: 'Error de client' })
    }

}
module.exports = { middlewareClient }