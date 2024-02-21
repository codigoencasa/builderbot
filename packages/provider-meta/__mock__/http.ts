import axios from 'axios'
import * as sinon from 'sinon'
export const httpsMock = {
    get: sinon.stub(axios, 'get'),
}
