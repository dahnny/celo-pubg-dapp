import {create as ipfsHttpClient} from "ipfs-http-client";
import axios from "axios";
import {Web3Storage} from 'web3.storage/dist/bundle.esm.min.js'

// initialize IPFS
const client = ipfsHttpClient("https://ipfs.infura.io:5001/api/v0");

// mint an NFT
export const createNft = async (
    minterContract,
    performActions,
    {name, description, ipfsImage, ownerAddress, attributes}
) => {
    await performActions(async (kit) => {
        if (!name || !description || !ipfsImage) return;
        const {defaultAccount} = kit;

        // convert NFT metadata to JSON format
        const data = JSON.stringify({
            name,
            description,
            image: ipfsImage,
            owner: defaultAccount,
            attributes,
        });

        try {

            // save NFT metadata to IPFS
            const added = await client.add(data);

            // IPFS url for uploaded metadata
            const url = `https://ipfs.infura.io/ipfs/${added.path}`;

            // mint the NFT and save the IPFS url to the blockchain
            let transaction = await minterContract.methods
                .safeMint(ownerAddress, url)
                .send({from: defaultAccount});

            return transaction;
        } catch (error) {
            console.log("Error uploading file: ", error);
        }
    });
};


// function to upload a file to IPFS
export const uploadToIpfs = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        const added = await client.add(file, {
            progress: (prog) => console.log(`received: ${prog}`),
        });
        return `https://ipfs.infura.io/ipfs/${added.path}`;
    } catch (error) {
        console.log("Error uploading file: ", error);
    }
};

// function to upload a file to IPFS via web3.storage
export const uploadFileToWebStorage = async (e) => {
    // Construct with token and endpoint
    const client = new Web3Storage({token: process.env.REACT_APP_STORAGE_API_KEY})

    const file = e.target.files;
    if (!file) return;
    // Pack files into a CAR and send to web3.storage
    const rootCid = await client.put(file) // Promise<CIDString>

    // Fetch and verify files from web3.storage
    const res = await client.get(rootCid) // Promise<Web3Response | null>
    const files = await res.files() // Promise<Web3File[]>

    return `https://ipfs.infura.io/ipfs/${files[0].cid}`;
}


// fetch all NFTs on the smart contract
export const getNfts = async (minterContract) => {
    try {
        const nfts = [];
        const nftsLength = await minterContract.methods.totalSupply().call();
        for (let i = 0; i < Number(nftsLength); i++) {
            const nft = new Promise(async (resolve) => {
                const res = await minterContract.methods.tokenURI(i).call();
                const meta = await fetchNftMeta(res);
                const owner = await fetchNftOwner(minterContract, i);
                resolve({
                    index: i,
                    owner,
                    name: meta.data.name,
                    image: meta.data.image,
                    description: meta.data.description,
                    attributes: meta.data.attributes,
                });
            });
            nfts.push(nft);
        }
        return Promise.all(nfts);
    } catch (e) {
        console.log({e});
    }
};

// get the metedata for an NFT from IPFS
export const fetchNftMeta = async (ipfsUrl) => {
    try {
        if (!ipfsUrl) return null;
        const meta = await axios.get(ipfsUrl);
        return meta;
    } catch (e) {
        console.log({e});
    }
};


// get the owner address of an NFT
export const fetchNftOwner = async (minterContract, index) => {
    try {
        return await minterContract.methods.ownerOf(index).call();
    } catch (e) {
        console.log({e});
    }
};

// get the address that deployed the NFT contract
export const fetchNftContractOwner = async (minterContract) => {
    try {
        let owner = await minterContract.methods.owner().call();
        return owner;
    } catch (e) {
        console.log({e});
    }
};