import axios from 'axios'
import { jest, describe, test, expect, afterEach } from '@jest/globals'
import { getMediaUrl } from '../src/utils'

jest.mock('axios')

describe('#getMediaUrl', () => {
    afterEach(() => {
        jest.clearAllMocks()
    })

    test('should return media URL when request is successful', async () => {
        // Arrange
        const version = 'v1'
        const idMedia = '123'
        const numberId = '456'
        const token = 'abc'
        const expectedUrl = 'https://example.com/media'
        const responseData = { url: expectedUrl }
        const axiosResponse = { data: responseData }
        ;(axios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValue(axiosResponse)

        // Act
        const result = await getMediaUrl(version, idMedia, numberId, token)

        // Assert
        expect(result).toBe(expectedUrl)
        expect(axios.get).toHaveBeenCalledWith(
            `https://graph.facebook.com/${version}/${idMedia}?phone_number_id=${numberId}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                maxBodyLength: Infinity,
            }
        )
    })

    test('should return undefined when request fails', async () => {
        // Arrange
        const version = 'v1'
        const idMedia = '123'
        const numberId = '456'
        const token = 'abc'
        const expectedErrorMessage = 'Error fetching media'
        const axiosError = new Error(expectedErrorMessage)

        const consoleErrorSpy = jest.spyOn(console, 'error')
        ;(axios.get as jest.MockedFunction<typeof axios.get>).mockRejectedValue(axiosError)

        // Act
        const result = await getMediaUrl(version, idMedia, numberId, token)

        // Assert
        expect(result).toBeUndefined()
        expect(consoleErrorSpy).toHaveBeenCalledWith(expectedErrorMessage)
    })
})
