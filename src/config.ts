import { Porto } from 'porto'
import { http, createConfig, createStorage } from 'wagmi'
import { odysseyTestnet } from 'wagmi/chains'

Porto.create()

export const config = createConfig({
    chains: [odysseyTestnet],
    storage: createStorage({ storage: localStorage }),
    transports: {
        [odysseyTestnet.id]: http(),
    },
})