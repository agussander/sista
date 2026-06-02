import { pb } from '$lib/pocketbase';

export const send = async (data) => {
    data = Object.assign({}, ...data);
    // console.log(data);
    
    data.curriculum =  new File([data.curriculum[0]], data.curriculum[0].name, { type: data.curriculum[0].type });
    const record = await pb.collection('trabajos').create(data);
    return record;
};