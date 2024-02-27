import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { httpsMock } from '../__mock__/http'
import { getProfile } from '../src/utils'

test('getProfile - should return profile infocorrectly', async () => {
    const jwtToken = 'your_jwt_token'
    const numberId = 'your_number_id'
    const version = 'v16.0'
    const responseData = {
        verified_name: 'Test Number',
        code_verification_status: 'NOT_VERIFIED',
        display_phone_number: '+1 555-060-5214',
        quality_rating: 'GREEN',
        platform_type: 'CLOUD_API',
        throughput: {
            level: 'STANDARD',
        },
        id: '108483132111799',
    }

    const mockedResponse = {
        data: responseData,
    }

    httpsMock.get.resolves(mockedResponse)

    const result = await getProfile(version, jwtToken, numberId)
    assert.equal(result, responseData)
})

test.run()
