import { supabase } from './src/config/supabase';

async function run() {
  const { data, error } = await supabase.from('users').select('*');
  console.log(JSON.stringify(data, null, 2));
}
run();
