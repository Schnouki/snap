import buble from 'rollup-plugin-buble';
import filesize from 'rollup-plugin-filesize';
import typescript from 'rollup-plugin-typescript';

export default {
	entry: 'src/index.ts',
	format: 'umd',
	moduleName: 'InstantClick',
	targets: [
		{	dest: 'build/instantclick.umd.js', format: 'umd' },
		{	dest: 'build/instantclick.es.js', format: 'es' }
	],
	plugins: [
		typescript(),
		buble({ transforms: { dangerousForOf: true } }),
		filesize()
	]
};
