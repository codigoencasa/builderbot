import { test } from 'uvu'
import * as assert from 'uvu/assert'
import {
    PROVIDER_LIST,
    Provider,
    PROVIDER_DATA,
    ProviderData,
    ProviderWithHint,
    ProviderWithoutHint,
} from '../src/configuration'

test('PROVIDER_LIST', () => {
    assert.ok(Array.isArray(PROVIDER_LIST))
    PROVIDER_LIST.forEach((provider: Provider) => {
        assert.type(provider.value, 'string')
        assert.type(provider.label, 'string')
        if ('hint' in provider) {
            assert.type(provider.hint, 'string')
        }
    })
})

test('PROVIDER_DATA', () => {
    assert.ok(Array.isArray(PROVIDER_DATA))
    PROVIDER_DATA.forEach((providerData: ProviderData) => {
        assert.type(providerData.value, 'string')
        assert.type(providerData.label, 'string')
    })
})

test('Provider With Hint', () => {
    const providersWithHint = PROVIDER_LIST.filter(
        (provider: Provider): provider is ProviderWithHint => 'hint' in provider
    )
    assert.ok(providersWithHint.length > 0)
    providersWithHint.forEach((providerWithHint) => {
        assert.type(providerWithHint.hint, 'string')
    })
})

test('Provider Without Hint', () => {
    const providersWithoutHint = PROVIDER_LIST.filter(
        (provider: Provider): provider is ProviderWithoutHint => !('hint' in provider)
    )
    assert.ok(providersWithoutHint.length > 0)
    providersWithoutHint.forEach((providerWithoutHint) => {
        assert.not('hint' in providerWithoutHint)
    })
})

test.run()
