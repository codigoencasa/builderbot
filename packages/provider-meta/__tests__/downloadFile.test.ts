import { describe, expect, jest, test } from '@jest/globals'
import axios, { AxiosResponse } from 'axios'
import mime from 'mime-types'
import { downloadFile, fileTypeFromFile } from '../src/utils'

jest.mock('axios')

describe('#fileTypeFromFile', () => {
    test('should return type and extension from response headers', async () => {
        // Arrange
        const response = {
            headers: { 'content-type': 'image/jpg' },
        }
        jest.spyOn(mime, 'extension').mockReturnValue('jpg')
        // Act
        const result = await fileTypeFromFile(response as any)

        // Assert
        expect(result).toEqual({ type: 'image/jpg', ext: 'jpg' })
    })

    test('should return null type and false extension when content-type is not present', async () => {
        // Arrange
        const response = {
            headers: {},
        }
        jest.spyOn(mime, 'extension').mockReturnValue(false)
        // Act
        const result = await fileTypeFromFile(response as any)

        // Assert
        expect(result).toEqual({ type: '', ext: false })
    })
})

describe('#downloadFile', () => {
    test('should download a file and return its buffer and extension', async () => {
        // Arrange
        const url = 'http://example.com/test.pdf'
        const token = 'fakeToken'
        const fakeResponseData = Buffer.from('fake file data')
        const fakeResponseHeaders = { 'content-type': 'application/pdf' }
        const fakeExtension = 'pdf'

        ;(axios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValueOnce({
            data: fakeResponseData,
            headers: fakeResponseHeaders,
        } as unknown as AxiosResponse)

        jest.spyOn(mime, 'extension').mockReturnValue(fakeExtension)
        // Act
        const result = await downloadFile(url, token)

        // Assert
        expect(result).toEqual({ buffer: fakeResponseData, extension: fakeExtension })
        expect(axios.get).toHaveBeenCalledTimes(1)
        expect(axios.get).toHaveBeenCalledWith(url, {
            headers: { Authorization: `Bearer ${token}` },
            maxBodyLength: Infinity,
            responseType: 'arraybuffer',
        })
    })

    test('should throw an error if unable to determine file extension', async () => {
        // Arrange
        const url = 'http://example.com/test.pdf'
        const token = 'fakeToken'
        const fakeResponseData = Buffer.from('fake file data')
        const fakeResponseHeaders = { 'content-type': 'application/pdf' }

        ;(axios.get as jest.MockedFunction<typeof axios.get>).mockResolvedValueOnce({
            data: fakeResponseData,
            headers: fakeResponseHeaders,
        } as unknown as AxiosResponse)

        jest.spyOn(mime, 'extension').mockReturnValue(false)
        const consoleErrorSpy = jest.spyOn(console, 'error')
        // Act
        await downloadFile(url, token)

        // Assert
        expect(consoleErrorSpy).toHaveBeenCalledWith('Unable to determine file extension')
        expect(axios.get).toHaveBeenCalledWith(url, {
            headers: { Authorization: `Bearer ${token}` },
            maxBodyLength: Infinity,
            responseType: 'arraybuffer',
        })
    })

    test('should handle axios error', async () => {
        // Arrange
        const url = 'http://example.com/test.pdf'
        const token = 'fakeToken'
        const errorMessage = 'Network Error'

        ;(axios.get as jest.MockedFunction<typeof axios.get>).mockRejectedValueOnce(new Error(errorMessage))
        const consoleErrorSpy = jest.spyOn(console, 'error')
        // Act
        await downloadFile(url, token)

        //Assert
        expect(consoleErrorSpy).toHaveBeenCalledWith(errorMessage)
        expect(axios.get).toHaveBeenCalledWith(url, {
            headers: { Authorization: `Bearer ${token}` },
            maxBodyLength: Infinity,
            responseType: 'arraybuffer',
        })
    })
})
