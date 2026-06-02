import { pb } from '$lib/pocketbase';

export let total;

let source;

const getRecords=async()=>{
    const records = await pb.collection(source).getFullList({
        sort: '-created',
    });
    data = records;
    total = records.length
}