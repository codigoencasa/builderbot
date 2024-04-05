import { getProfile } from '../src/utils'
import axios from 'axios'
import { describe, expect, jest, test } from '@jest/globals'

jest.mock('axios')

describe('#getProfile ', () => {
    test('should return WhatsApp profile data correctly', async () => {
        // Arrange
        const version = '1.0'
        const numberId = '123456789'
        const token = 'fakeToken'
        const expectedProfileData = {
            id: '123456789',
            name: 'John Doe',
            profile_pic: 'https://example.com/profile_pic.jpg',
            status: 'Hey there! I am using WhatsApp.',
        }

        // Simular la respuesta de axios
        const axiosResponse = {
            data: expectedProfileData,
        }
        ;(axios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValue(axiosResponse)

        // Act
        const result = await getProfile(version, numberId, token)

        // Assert
        expect(result).toEqual(expectedProfileData)
        expect(axios.get).toHaveBeenCalledWith(`https://graph.facebook.com/${version}/${numberId}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
    })
})
