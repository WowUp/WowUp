#!/bin/bash

## Creicns Ver 0.1.0 Written by Unbinilium https://github.com/Unbinilium/Creicns

[ -z "$(echo "$OSTYPE" | /usr/bin/grep "darwin*")" ] && { echo -e "\033[31;1mError:\033[0m creicns.sh only support macOS"; exit 1; }

src_image="$1"
[ -z "$src_image" ] && { echo -e "\033[32;1mUseage:\033[0m bash creicns.sh <raw image path>"; exit 1; }

echo -e "\033[32;1mCreicns:\033[0m loading raw image from '${src_image}'"

tmp_dir_path="/tmp/creicns-$(/bin/cat /dev/urandom | LC_CTYPE=C tr -dc 'a-zA-Z0-9' | fold -w 8 | head -n 1)-$(/bin/date +"%Y-%m-%d")"
[ -e "$tmp_dir_path" ] && /bin/rm -fr "$tmp_dir_path"
echo -e "\033[32;1mCreicns:\033[0m creating tmp folder at '$tmp_dir_path'"
/bin/mkdir "$tmp_dir_path"

if [ "${src_image:(-3)}" != "png" ]; then
    echo -e "\033[32;1mCreicns:\033[0m converting raw image to '.png' format"
    /usr/bin/sips -s format png "$src_image" --out "${tmp_dir_path}/${src_image}.png" &> /dev/null || { echo -e "\033[31;1mError:\033[0m raw image could not be converted to PNG format"; exit 1; }
    src_image="${tmp_dir_path}/${src_image}.png"
fi

icns_name="$(/usr/bin/basename -s ".png" "$src_image")"
iconset_path="${tmp_dir_path}/${icns_name}.iconset"
[ -e "$iconset_path" ] && /bin/rm -fr "$iconset_path"
echo -e "\033[32;1mCreicns:\033[0m creating '${icns_name}.iconset' folder at '$iconset_path'"
/bin/mkdir "$iconset_path"

echo -e "\033[32;1mCreicns:\033[0m creating icon files in '$iconset_path'"
icon_file_list=("icon_16x16.png" "icon_16x16@2x.png" "icon_32x32.png" "icon_32x32@2x.png" "icon_128x128.png" "icon_128x128@2x.png" "icon_256x256.png" "icon_256x256@2x.png" "icon_512x512.png" "icon_512x512@2x.png")
icon_size_list=('16' '32' '32' '64' '128' '256' '256' '512' '512' '1024')
i=0    
for icon_file in ${icon_file_list[@]}; do
    icon_path="${iconset_path}/${icon_file}"
    /bin/cp -f "$src_image" "$icon_path"
    icon_size=${icon_size_list[$((i++))]}
    /usr/bin/sips -z "$icon_size" "$icon_size" "$icon_path" &> /dev/null
done

echo -e "\033[32;1mCreicns:\033[0m creating '${icns_name}.icns' from '$iconset_path'"
/usr/bin/iconutil -c icns "$iconset_path" || { echo -e "\033[31;1mError:\033[0m failed to create the '.icns' file"; exit 1; }

echo -e "\033[32;1mCreicns:\033[0m moving '${icns_name}.icns' from '${tmp_dir_path}/${icns_name}.icns' to '$(/usr/bin/dirname "$1")/${icns_name}.icns'"
/bin/mv -f "${tmp_dir_path}/${icns_name}.icns" "$(/usr/bin/dirname "$1")/${icns_name}.icns"

echo -e "\033[32;1mCreicns:\033[0m cleaning up tmp folder '$tmp_dir_path'"
/bin/rm -rf "${tmp_dir_path}"

echo -e "\033[32;1mCreicns:\033[0m successfully created '$(/usr/bin/dirname "$1")/${icns_name}.icns' from '$1'"
exit 0
