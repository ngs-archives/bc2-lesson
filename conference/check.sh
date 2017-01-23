#!/bin/bash
# Find bc2 path
COL_GREEN="\033[1;32m"
COL_RED="\033[1;31m"
COL_CYAN="\033[1;36m"
COL_BLUE="\033[1;34m"
COL_YELLOW="\033[1;33m"
COL_CLR="\033[m"

function print()
{
    echo -e "\n"$COL_CYAN"$@"$COL_CLR
}

function nberr()
{
    echo -e $COL_RED"✗ $@"$COL_CLR
}

function err()
{
    echo -e $COL_RED"✗ $@"$COL_CLR
    exit 1
}

function ok()
{
    echo -e $COL_GREEN"✓ $@"$COL_CLR
}

function warn()
{
    echo -e $COL_YELLOW"$@"$COL_CLR
}

function fexistchk()
{
    if [ -e "$1" ]; then
        ok "$1が存在します"
        return 0
    fi
    shift
    err "$1が存在しません。$*"
}

function execchk()
{
    echo "$ $@"
    "$@"
    if [ $? -ne 0 ]; then
        err "エラー発生：$@0"
    fi
}

print "環境チェック："
HOST_OS=linux
which systemctl &>/dev/null
if [ $? -ne 0 ]; then
    which launchctl &>/dev/null
    if [ $? -eq 0 ]; then
        # macOS
        HOST_OS=macos
    else
        # ???
        err "環境が確認出来ません"
    fi
fi
ok "OS=$HOST_OS"

DIRNAME=$(dirname $0)
if [ "$DIRNAME" = "." ]; then
    DIRNAME=""
fi
FULLPATH=$PWD/$DIRNAME
BC2PATH=${FULLPATH:0:$((${#FULLPATH}-11))}
print "BC2フォルダー: $COL_BLUE$BC2PATH"

if [ ! -e "$BC2PATH/src/bitcoin-cli.cpp" ]; then
    warn "BC2フォルダーが正しくないようです。"
    warn "$BC2PATH/src/bitcoin-cli.cppというファイルが存在しません。"
    err "BC2フォルダーが見つかりませんでした"
fi

# git 確認
print "repoのチェック:"

branch=$(git symbolic-ref --short HEAD)
CHANGES=$(git diff-index --name-only HEAD --)

# Checking repository
if [ "$branch" != "bc2" ]; then
    warn "branchがbc2ではありません。（$branchです）"
    warn "bc2のbranchに戻してからチェックを行って下さい"
    warn "戻す方法："
    warn "  git checkout bc2"
    if [ -n "$CHANGES" ]; then
        warn "エラーが出たら、自分が変えたファイルをコミットしていない可能性があります"
        warn "ファイルを保存したい場合は、"
        warn "  git commit -am \"メッセージ\""
        warn "を入れてから"
        warn "  git checkout bc2"
        warn "を入れると良いです。"
        warn "リセットしたい場合は、"
        warn "  git reset --hard origin/bc2"
        warn "を入れるとなくなります。gitのマニュアルを参考に。"
    fi
    err "branchがbc2ではありません"
fi
ok "branch=bc2"

# Checking git changes
if [ -n "$CHANGES" ]; then
    warn "gitにコミットされていないファイルが以下のようにあります："
    echo $CHANGES
    warn "ファイルを保存したければ、新しいbranchを作って、コミットして下さい。例："
    warn "  git checkout -b $USER-test"
    warn "リセットしたい場合は、"
    warn "  git reset --hard origin/bc2"
    err "repoがcleanではありません"
fi
ok "repoはclean"

# Checking if up to date
git fetch origin bc2 2>/dev/null
CURRCOMMIT=$(git rev-parse HEAD)
LATESTCOMMIT=$(git rev-parse origin/bc2)
if [ "$CURRCOMMIT" != "$LATESTCOMMIT" ]; then
    warn "最新のrepoではありません。"
    warn "最新のrepoにする為に、"
    warn "  git pull"
    warn "を入れる必要があります。"
    err "最新のrepoではありません"
fi
ok "最新のrepo確認"

# BC2 binary check
print "bitcoinのチェック："

cd "$BC2PATH/src"
HINT="コンパイルする必要があるかもしれません： makeを入れたらコンパイルします。"
fexistchk ./bitcoind "$HINT"
fexistchk ./bitcoin-cli "$HINT"

SHORTCOMMIT=${LATESTCOMMIT:0:7}
EXPVERSION="BC2-Bitcoin Core RPC client version v0.13.2.0-$SHORTCOMMIT"
GOTVERSION=$(./bitcoin-cli -version)

if [ "$EXPVERSION" != "$GOTVERSION" ]; then
    warn "バージョンが違います。"
    warn "  現在：$GOTVERSION"
    warn "  想定：$EXPVERSION"
    warn "恐らくコンパイルする必要があります。"
    warn "  make"
    warn "を入れるとコンパイルが行われます。エラーが出た場合、"
    warn "  cd \"$BC2PATH\""
    warn "  ./autogen.sh"
    warn "  ./configure"
    warn "  make"
    warn "を入れる必要があるかもしれません。"
    err "想定外のバージョン"
fi
ok "バージョン確認"

print ".net"

cd "$BC2PATH/"
if [ -e ".tmp" ]; then
    rm -rf .tmp
fi
execchk mkdir .tmp
execchk cd .tmp
execchk mkdir hwapp
execchk cd hwapp
execchk dotnet new
execchk dotnet restore
execchk dotnet run > run.out
HW=$(tail -n 1 run.out)
if [ "$HW" != "Hello World!" ]; then
    warn "Hello Worldの出力が想定外でした："
    warn "  現在：\"$HW\""
    warn "  想定：\"Hello World!\""
    err ".netサンプルの想定外の出力"
fi
ok "サンプル出力確認"

# Clean up
cd ../
rm -rf .tmp

print "node.js"

# Figure out binary name
NODE=nodejs
which $NODE &>/dev/null
if [ $? -ne 0 ]; then
    NODE=node
    which $NODE &>/dev/null
    if [ $? -ne 0 ]; then
        err "nodejs/nodeが見つかりませんでした。インストールされていますか？"
    fi
fi
ok "nodejs=$(which $NODE)"

GOTNODEVER=$($NODE -v)
EXPNODEVERPREFIX="v7."

if [ "${GOTNODEVER:0:${#EXPNODEVERPREFIX}}" != "$EXPNODEVERPREFIX" ]; then
    warn "node.jsのバージョンが想定外です。"
    warn "  現在：$GOTNODEVER"
    warn "  想定：$EXPNODEVERPREFIX*"
    err "想定外のnode.jsバージョン"
fi
ok "バージョン確認"

print "npm"

which npm &>/dev/null
if [ $? -ne 0 ]; then
    err "npmが見つかりませんでした"
fi
ok "npm=$(which npm)"

GOTNPMVER=$(npm -v)
EXPNPMVERPREFIX="4."
EXPNPMVERPREFIX2="3."

if [ "${GOTNPMVER:0:${#EXPNPMVERPREFIX}}" != "$EXPNPMVERPREFIX" ] && [ "${GOTNPMVER:0:${#EXPNPMVERPREFIX2}}" != "$EXPNPMVERPREFIX2" ]; then
    warn "npmのバージョンが想定外です。"
    warn "  現在：$GOTNPMVER"
    warn "  想定：$EXPNPMVERPREFIX* 若しくは $EXPNPMVERPREFIX2"
    err "想定外のnpmバージョン"
fi
ok "バージョン確認"

MOCHARES=$(npm ls -g mocha 2>/dev/null)
if echo "$MOCHARES" | grep -q "3."; then
    ok "mocha確認"
else
    err "mochaが確認出来ませんでした。npm install -g mochaを実行すれば直るかもしれません。"
fi

if [ "$HOST_OS" = "linux" ]; then
    systemctl show mongodb | grep "SubState=running" &>/dev/null
    if [ $? -ne 0 ]; then
        warn "MongoDBがrunningではありません："
        systemctl status mongodb
        err "MongoDBがrunningではありません"
    fi
elif [ "$HOST_OS" = "macos" ]; then
    launchctl list | grep -i mongo &>/dev/null
    if [ $? -ne 0 ]; then
        warn "MongoDBが実行されていません。"
        warn "  brew services start mongodb"
        warn "を入れる必要があるかもしれません。"
        err "MongoDBが実行されていません"
    fi
fi    
ok "MongoDB確認"

ok "*** Ａｌｌ　Ｃｌｅａｒ ***"
ok "Welcome to ＢＣ２！"
