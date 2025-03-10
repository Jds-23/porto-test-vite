import { Hooks } from 'porto/wagmi'
import { type Hex, parseEther } from 'viem'
import {
  useAccount,
  useBalance,
  useConnectors,
} from 'wagmi'
import { useCallsStatus, useSendCalls } from 'wagmi/experimental'

import { useEffect, useState } from 'react'
import {
  generatePrivateKey,
  privateKeyToAccount,
  privateKeyToAddress,
} from 'viem/accounts'
import { ExperimentERC20 } from './contracts.js'

const key = () =>
  ({
    expiry: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
    permissions: {
      calls: [
        {
          to: ExperimentERC20.address,
        },
      ],
      spend: [
        {
          limit: parseEther('50'),
          period: 'minute',
          token: ExperimentERC20.address,
        },
      ],
    },
  }) as const

export function App() {
  const { isConnected } = useAccount()
  return (
    <>
      <Account />
      {isConnected ? (
        <>
          <GrantPermissions />
          <Mint />
        </>
      ) : (
        <>
          <Connect />
          <UpgradeAccount />
        </>
      )}
    </>
  )
}

function Account() {
  const account = useAccount()
  const { data: permissions } = Hooks.usePermissions()
  const disconnect = Hooks.useDisconnect()

  return (
    <div>
      <h2>Account</h2>

      <div>
        account: {account.address}
        <br />
        chainId: {account.chainId}
        <br />
        status: {account.status}
        <br />
        permissions: {JSON.stringify(permissions)}
      </div>

      {account.status !== 'disconnected' && (
        <button type="button" onClick={() => disconnect.mutate({})}>
          Log Out
        </button>
      )}
    </div>
  )
}

function Connect() {
  const [grantPermissions, setGrantPermissions] = useState<boolean>(true)

  const connectors = useConnectors()
  const connect = Hooks.useConnect()

  return (
    <div>
      <h2>Connect</h2>
      <label>
        <input
          type="checkbox"
          checked={grantPermissions}
          onChange={() => setGrantPermissions((x) => !x)}
        />
        Grant Permissions
      </label>
      {connectors
        .filter((x) => x.id === 'xyz.ithaca.porto')
        ?.map((connector) => (
          <div key={connector.uid}>
            <button
              key={connector.uid}
              onClick={() =>
                connect.mutate({
                  connector,
                  grantPermissions: grantPermissions ? key() : undefined,
                })
              }
              type="button"
            >
              Login
            </button>
            <button
              onClick={() =>
                connect.mutate({
                  connector,
                  createAccount: true,
                  grantPermissions: grantPermissions ? key() : undefined,
                })
              }
              type="button"
            >
              Register
            </button>
          </div>
        ))}
      <div>{connect.status}</div>
      <div>{connect.error?.message}</div>
    </div>
  )
}

function UpgradeAccount() {
  const [accountData, setAccountData] = useState<{
    address: string
    privateKey: string
  } | null>(null)
  const [grantPermissions, setGrantPermissions] = useState<boolean>(true)
  const [privateKey, setPrivateKey] = useState<string>('')

  const connectors = useConnectors()
  const upgradeAccount = Hooks.useUpgradeAccount()

  return (
    <div>
      <h2>Upgrade Account</h2>
      <p>
        <button
          onClick={() => {
            const privateKey = generatePrivateKey()
            setPrivateKey(privateKey)
            setAccountData({
              privateKey,
              address: privateKeyToAddress(privateKey),
            })
          }}
          type="button"
        >
          Create EOA
        </button>
        {accountData && <pre>{JSON.stringify(accountData, null, 2)}</pre>}
      </p>
      <div>
        <input
          type="text"
          value={privateKey}
          onChange={(e) => setPrivateKey(e.target.value)}
          placeholder="Private Key"
          style={{ width: '300px' }}
        />
      </div>
      <div>
        <label>
          <input
            type="checkbox"
            checked={grantPermissions}
            onChange={() => setGrantPermissions((x) => !x)}
          />
          Grant Permissions
        </label>
      </div>
      {connectors
        .filter((x) => x.id === 'xyz.ithaca.porto')
        ?.map((connector) => (
          <button
            key={connector.uid}
            onClick={() =>
              upgradeAccount.mutate({
                account: privateKeyToAccount(privateKey as Hex),
                connector,
                grantPermissions: grantPermissions ? key() : undefined,
              })
            }
            type="button"
          >
            Upgrade EOA to Porto Account
          </button>
        ))}
      <div>{upgradeAccount.status}</div>
      <div>{upgradeAccount.error?.message}</div>
    </div>
  )
}

// function Balance() {
//   const { address } = useAccount()
//   const { data: balance } = useReadContract({
//     ...ExperimentERC20,
//     query: {
//       enabled: !!address,
//       refetchInterval: 2_000,
//     },
//     functionName: 'balanceOf',
//     args: [address!],
//   })

//   return (
//     <div>
//       <h2>Balance</h2>
//       <div>Balance: {formatEther(balance ?? 0n)} EXP</div>
//     </div>
//   )
// }

function GrantPermissions() {
  const permissions = Hooks.usePermissions()
  const grantPermissions = Hooks.useGrantPermissions()

  if (permissions.data?.length !== 0) return null
  return (
    <div>
      <h2>Grant Permissions</h2>
      <button onClick={() => grantPermissions.mutate(key())} type="button">
        Grant Permissions
      </button>
      {grantPermissions.data && <div>Permissions granted.</div>}
      {grantPermissions.error && (
        <div>
          Error:{' '}
          {grantPermissions.error.shortMessage ||
            grantPermissions.error.message}
        </div>
      )}
    </div>
  )
}

function Mint() {
  const { address } = useAccount()
  const { data: id, error, isPending, sendCalls } = useSendCalls()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useCallsStatus({
    id: id as string,
    query: {
      enabled: !!id,
      refetchInterval: ({ state }) => {
        if (state.data?.status === 'CONFIRMED') return false
        return 1_000
      },
    },
  })

  const balance = useBalance()
  const [transactions, setTransactions] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (id) setTransactions((prev) => new Set([...prev, id]))
  }, [id])

  return (
    <div>
      <h3>[client] Mint EXP [balance: {balance.data?.formatted}]</h3>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          sendCalls({
            calls: [
              {
                functionName: 'mint',
                abi: ExperimentERC20.abi,
                to: ExperimentERC20.address[0],
                args: [address!, parseEther('100')],
              },
            ],
          })
        }}
      >
        <button
          type="submit"
          disabled={isPending}
          style={{ marginBottom: '5px' }}
        >
          {isPending ? 'Confirming...' : 'Mint 100 EXP'}
        </button>
      </form>
      <ul style={{ listStyleType: 'none', padding: 0 }}>
        {Array.from(transactions).map((tx) => (
          <li key={tx}>
            <a
              target="_blank"
              rel="noopener noreferrer"
              href={`https://odyssey-explorer.ithaca.xyz/tx/${tx}`}
            >
              {tx}
            </a>
          </li>
        ))}
      </ul>
      <p>{isConfirming && 'Waiting for confirmation...'}</p>
      <p>{isConfirmed && 'Transaction confirmed.'}</p>
      {error && (
        <div>
          Error: {error.message}
        </div>
      )}
    </div>
  )
}